import draggable from "vuedraggable";
import { auth, db, googleProvider } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export default {
  name: "NasdaqFiboChecklist",
  components: {
    draggable
  },

  data() {
    return {
      currentTime: "",
      todayDate: "",
      timer: null,

      newTask: "",
      rValue: 50,
      goalUSD: 3000,
      tasks: [],
      trades: [],
      audioContext: null,

      isDarkMode: true,

      user: null,
      authReady: false,
      isHydratingFromCloud: false,
      saveTimer: null,
      unsubscribeAuth: null,
      unsubscribeBoard: null,
      justSavedLocallyAt: 0,

      sessionFilter: "All",
      isEditing: false,
      editingTradeId: null,

      tradeForm: {
        date: new Date().toISOString().slice(0, 10),
        session: "",
        direction: "",
        setup: "",
        resultR: 1,
        note: ""
      }
    };
  },

  computed: {
    completedCount() {
      return this.tasks.filter(task => task.done).length;
    },

    allCompleted() {
      return this.tasks.length > 0 && this.tasks.every(task => task.done);
    },

    progressPercent() {
      if (!this.tasks.length) return 0;
      return Math.round((this.completedCount / this.tasks.length) * 100);
    },

    safeRValue() {
      const n = Number(this.rValue);
      return Number.isFinite(n) && n > 0 ? n : 1;
    },

    safeGoalUSD() {
      const n = Number(this.goalUSD);
      return Number.isFinite(n) && n > 0 ? n : 1;
    },

    goalR() {
      return this.safeGoalUSD / this.safeRValue;
    },

    totalR() {
      return this.trades.reduce((sum, trade) => sum + this.getSafeR(trade.resultR), 0);
    },

    totalUSD() {
      return this.totalR * this.safeRValue;
    },

    remainingR() {
      return Math.max(this.goalR - this.totalR, 0);
    },

    remainingUSD() {
      return this.remainingR * this.safeRValue;
    },

    goalProgressPercent() {
      if (!this.goalR) return 0;
      const pct = (this.totalR / this.goalR) * 100;
      return Math.min(Math.max(Math.round(pct), 0), 100);
    },

    targetProgressPercent() {
      return this.goalProgressPercent;
    },

    todaysTrades() {
      const today = new Date().toISOString().slice(0, 10);
      return this.trades.filter(trade => trade.date === today).length;
    },

    todaysR() {
      const today = new Date().toISOString().slice(0, 10);
      return this.trades
        .filter(trade => trade.date === today)
        .reduce((sum, trade) => sum + this.getSafeR(trade.resultR), 0);
    },

    winRate() {
      if (!this.trades.length) return 0;
      const winners = this.trades.filter(trade => this.getSafeR(trade.resultR) > 0).length;
      return Math.round((winners / this.trades.length) * 100);
    },

    dailyMaxTrades() {
      return 999;
    },

    dailyMaxLossR() {
      return -999;
    },

    dailyLimitReached() {
      return this.todaysTrades >= this.dailyMaxTrades;
    },

    dailyLossLimitReached() {
      return this.todaysR <= this.dailyMaxLossR;
    },

    filteredTrades() {
      if (this.sessionFilter === "All") return this.trades;
      return this.trades.filter(trade => trade.session === this.sessionFilter);
    },

    curveData() {
      let cumulative = 0;

      return this.filteredTrades.map((trade, index) => {
        cumulative += this.getSafeR(trade.resultR);
        return {
          index,
          cumulative
        };
      });
    },

    curvePoints() {
      if (this.curveData.length === 0) return [];

      const width = 1000;
      const height = 260;
      const paddingX = 40;
      const paddingY = 24;

      const values = this.curveData.map(p => p.cumulative);
      values.push(0, this.goalR);

      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      let range = maxVal - minVal;
      if (range === 0) range = 1;

      return this.curveData.map((point, idx) => {
        const x = this.curveData.length === 1
          ? width / 2
          : paddingX + (idx * (width - paddingX * 2)) / (this.curveData.length - 1);

        const normalized = (point.cumulative - minVal) / range;
        const y = height - paddingY - normalized * (height - paddingY * 2);

        return { x, y };
      });
    },

    curvePolyline() {
      return this.curvePoints.map(point => `${point.x},${point.y}`).join(" ");
    },

    zeroLineY() {
      if (this.curveData.length === 0) return null;

      const height = 260;
      const paddingY = 24;
      const values = this.curveData.map(p => p.cumulative);
      values.push(0, this.goalR);

      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      let range = maxVal - minVal;
      if (range === 0) range = 1;

      const normalized = (0 - minVal) / range;
      return height - paddingY - normalized * (height - paddingY * 2);
    }
  },

  watch: {
    tasks: {
      handler(newTasks) {
        try {
          this.justSavedLocallyAt = Date.now();

          const normalizedTasks = newTasks.map(task => ({
            id: task.id,
            text: task.text,
            done: Boolean(task.done)
          }));

          localStorage.setItem(
            "nasdaq_tasks_professional",
            JSON.stringify(normalizedTasks)
          );

          this.scheduleCloudSave();
        } catch (error) {
          console.error("Error al guardar tareas:", error);
        }
      },
      deep: true
    },

    trades: {
      handler(newTrades) {
        try {
          localStorage.setItem("nasdaq_trades_curve", JSON.stringify(newTrades));
          this.scheduleCloudSave();
        } catch (error) {
          console.error("Error al guardar trades:", error);
        }
      },
      deep: true
    },

    rValue(newVal) {
      this.justSavedLocallyAt = Date.now();
      const safeValue = Number(newVal);
      localStorage.setItem(
        "nasdaq_r_value_only_tasks",
        JSON.stringify(safeValue > 0 ? safeValue : 1)
      );
      this.scheduleCloudSave();
    },

    goalUSD(newVal) {
      this.justSavedLocallyAt = Date.now();
      const safeValue = Number(newVal);
      localStorage.setItem(
        "nasdaq_goal_usd_only_tasks",
        JSON.stringify(safeValue > 0 ? safeValue : 3000)
      );
      this.scheduleCloudSave();
    }
  },

  mounted() {
    this.updateClock();
    this.timer = setInterval(() => {
      this.updateClock();
    }, 1000);

    this.loadLocalData();

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    }

    this.unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      this.user = currentUser;
      this.authReady = true;

      if (this.unsubscribeBoard) {
        this.unsubscribeBoard();
        this.unsubscribeBoard = null;
      }

      if (!currentUser) return;

      const boardRef = doc(db, "users", currentUser.uid, "boards", "main");

      this.unsubscribeBoard = onSnapshot(boardRef, snapshot => {
        if (!snapshot.exists()) {
          this.saveToCloud();
          return;
        }

        const now = Date.now();
        if (now - this.justSavedLocallyAt < 3000) return;

        const data = snapshot.data();
        this.isHydratingFromCloud = true;

        this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
        this.trades = Array.isArray(data.trades) ? data.trades : [];
        this.rValue = Number(data.rValue) > 0 ? Number(data.rValue) : 50;
        this.goalUSD = Number(data.goalUSD) > 0 ? Number(data.goalUSD) : 3000;

        this.isHydratingFromCloud = false;
      });
    });
  },

  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    if (this.unsubscribeBoard) this.unsubscribeBoard();
    if (this.saveTimer) clearTimeout(this.saveTimer);
  },

  methods: {
    updateClock() {
      const now = new Date();

      this.currentTime = now.toLocaleTimeString("es-PE", {
        hour12: false
      });

      this.todayDate = now.toLocaleDateString("es-PE");
    },

    onDragEnd() {
      this.tasks = [...this.tasks];
      this.justSavedLocallyAt = Date.now();

      try {
        localStorage.setItem(
          "nasdaq_tasks_professional",
          JSON.stringify(this.tasks)
        );
      } catch (error) {
        console.error("Error al guardar orden de tareas:", error);
      }

      this.scheduleCloudSave();
    },

    loadLocalData() {
      try {
        const savedTasks = localStorage.getItem("nasdaq_tasks_professional");
        if (savedTasks) {
          const parsed = JSON.parse(savedTasks);
          this.tasks = Array.isArray(parsed) ? parsed : [];
        }

        const savedTrades = localStorage.getItem("nasdaq_trades_curve");
        if (savedTrades) {
          const parsedTrades = JSON.parse(savedTrades);
          this.trades = Array.isArray(parsedTrades) ? parsedTrades : [];
        }

        const savedRValue = localStorage.getItem("nasdaq_r_value_only_tasks");
        if (savedRValue) {
          const parsedR = Number(JSON.parse(savedRValue));
          this.rValue = parsedR > 0 ? parsedR : 50;
        }

        const savedGoalUSD = localStorage.getItem("nasdaq_goal_usd_only_tasks");
        if (savedGoalUSD) {
          const parsedGoal = Number(JSON.parse(savedGoalUSD));
          this.goalUSD = parsedGoal > 0 ? parsedGoal : 3000;
        }
      } catch (error) {
        console.error("Error al leer datos locales:", error);
      }
    },

    getSafeR(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    },

    async signInWithGoogle() {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("Error al iniciar con Google:", error);
        alert("No se pudo iniciar sesión con Google.");
      }
    },

    async signOutUser() {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
      }
    },

    scheduleCloudSave() {
      if (!this.user || this.isHydratingFromCloud) return;

      if (this.saveTimer) clearTimeout(this.saveTimer);

      this.saveTimer = setTimeout(() => {
        this.saveToCloud();
      }, 500);
    },

    async saveToCloud() {
      if (!this.user || this.isHydratingFromCloud) return;

      this.isHydratingFromCloud = true;

      try {
        const boardRef = doc(db, "users", this.user.uid, "boards", "main");

        await setDoc(
          boardRef,
          {
            tasks: this.tasks,
            trades: this.trades,
            rValue: this.safeRValue,
            goalUSD: this.safeGoalUSD,
            updatedAt: serverTimestamp(),
            userEmail: this.user.email || "",
            userName: this.user.displayName || ""
          },
          { merge: true }
        );

        this.justSavedLocallyAt = Date.now();
      } catch (error) {
        console.error("Error al guardar en Firebase:", error);
      } finally {
        this.isHydratingFromCloud = false;
      }
    },

    addTask() {
      const text = this.newTask.trim();

      if (!text) {
        alert("Escribe una tarea primero.");
        return;
      }

      this.justSavedLocallyAt = Date.now();

      const newItem = {
        id: Date.now() + Math.random(),
        text,
        done: false
      };

      this.tasks = [...this.tasks, newItem];

      try {
        localStorage.setItem(
          "nasdaq_tasks_professional",
          JSON.stringify(this.tasks)
        );
      } catch (error) {
        console.error("Error guardando tarea local:", error);
      }

      this.newTask = "";

      this.scheduleCloudSave();
    },

    removeTask(id) {
      this.justSavedLocallyAt = Date.now();
      this.tasks = this.tasks.filter(task => task.id !== id);
      try {
        localStorage.setItem(
          "nasdaq_tasks_professional",
          JSON.stringify(this.tasks)
        );
      } catch (error) {
        console.error("Error guardando cambios de tareas:", error);
      }
      this.scheduleCloudSave();
    },

    toggleTaskDone(task) {
      this.justSavedLocallyAt = Date.now();
      this.tasks = this.tasks.map(item =>
        item.id === task.id ? { ...item, done: !item.done } : item
      );
      try {
        localStorage.setItem(
          "nasdaq_tasks_professional",
          JSON.stringify(this.tasks)
        );
      } catch (error) {
        console.error("Error guardando cambios de tareas:", error);
      }
      this.scheduleCloudSave();
    },

    clearCompleted() {
      this.justSavedLocallyAt = Date.now();
      this.tasks = this.tasks.filter(task => !task.done);
      try {
        localStorage.setItem(
          "nasdaq_tasks_professional",
          JSON.stringify(this.tasks)
        );
      } catch (error) {
        console.error("Error guardando cambios de tareas:", error);
      }
      this.scheduleCloudSave();
    },

    resetTradeForm() {
      this.tradeForm = {
        date: new Date().toISOString().slice(0, 10),
        session: "",
        direction: "",
        setup: "",
        resultR: 1,
        note: ""
      };
      this.isEditing = false;
      this.editingTradeId = null;
    },

    saveTrade() {
      const resultR = this.getSafeR(this.tradeForm.resultR);

      const tradePayload = {
        id: this.isEditing ? this.editingTradeId : Date.now() + Math.random(),
        date: this.tradeForm.date,
        session: this.tradeForm.session,
        direction: this.tradeForm.direction,
        setup: this.tradeForm.setup.trim(),
        resultR,
        resultUSD: resultR * this.safeRValue,
        note: this.tradeForm.note.trim()
      };

      if (!tradePayload.date || !tradePayload.session || !tradePayload.direction) {
        alert("Completa fecha, sesión y dirección.");
        return;
      }

      if (this.isEditing) {
        this.trades = this.trades.map(trade =>
          trade.id === this.editingTradeId ? tradePayload : trade
        );
      } else {
        this.trades = [...this.trades, tradePayload];
      }

      this.justSavedLocallyAt = Date.now();
      this.resetTradeForm();
    },

    editTrade(trade) {
      this.tradeForm = {
        date: trade.date,
        session: trade.session,
        direction: trade.direction,
        setup: trade.setup,
        resultR: trade.resultR,
        note: trade.note
      };

      this.isEditing = true;
      this.editingTradeId = trade.id;
    },

    removeTrade(id) {
      this.trades = this.trades.filter(trade => trade.id !== id);
      this.justSavedLocallyAt = Date.now();
    },

    triggerCelebration() {
      this.celebrationPlayed = true;
      this.showCelebration = true;
      this.playSoftCelebrationSound();

      setTimeout(() => {
        this.showCelebration = false;
      }, 2000);
    },

    playSoftCelebrationSound() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!this.audioContext) {
          this.audioContext = new AudioCtx();
        }

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.06, now + 0.15);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
        master.connect(ctx.destination);

        const notes = [
          { freq: 523.25, start: 0.0, duration: 0.45 },
          { freq: 659.25, start: 0.28, duration: 0.45 },
          { freq: 783.99, start: 0.58, duration: 0.5 },
          { freq: 659.25, start: 1.0, duration: 0.45 },
          { freq: 880.0, start: 1.28, duration: 0.5 }
        ];

        notes.forEach(note => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(note.freq, now + note.start);

          gain.gain.setValueAtTime(0.0001, now + note.start);
          gain.gain.exponentialRampToValueAtTime(0.18, now + note.start + 0.06);
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + note.start + note.duration
          );

          osc.connect(gain);
          gain.connect(master);

          osc.start(now + note.start);
          osc.stop(now + note.start + note.duration);
        });
      } catch (error) {
        console.error("No se pudo reproducir el sonido:", error);
      }
    },

    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }
  }
};