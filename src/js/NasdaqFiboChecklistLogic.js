import draggable from "vuedraggable";
import { auth, db, googleProvider } from "../firebase";
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
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
      lastSpokenMinute: null,
      showCelebration: false,
      celebrationPlayed: false,
      taskVoiceMuted: false,

      newTask: "",
      rValue: 50,
      goalUSD: 3000,
      tasks: [],
      trades: [],
      audioContext: null,
      pomodoro: {
        targetFocusMinutes: 240,
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakEvery: 4,
        currentMode: "focus",
        secondsLeft: 25 * 60,
        isRunning: false,
        completedFocusSessions: 0,
        totalFocusedSeconds: 0,
        lastTickAt: null
      },
      lastPomodoroLocalSaveAt: 0,
      lastPomodoroCloudSaveAt: 0,
      pomodoroGoalCelebrated: false,

      isDarkMode: true,

      user: null,
      authReady: false,
      authErrorMessage: "",
      authInfoMessage: "",
      syncState: "local",
      lastCloudSyncAt: null,
      isSigningIn: false,
      isHydratingFromCloud: false,
      isLoadingLocalData: false,
      saveTimer: null,
      unsubscribeAuth: null,
      unsubscribeBoard: null,
      hasReceivedInitialBoardSnapshot: false,
      justSavedLocallyAt: 0,

      sessionFilter: "All",
      currentCalendarMonth: new Date().toISOString().slice(0, 7),
      isEditing: false,
      editingTradeId: null,
      emotionChecklist: {
        state: ""
      },

      tradeForm: {
        date: new Date().toISOString().slice(0, 10),
        session: "",
        direction: "",
        setup: "",
        resultR: 1,
        note: ""
      },
      availableVoices: []
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

    advancedGoalUSD() {
      return this.totalUSD;
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

    pomodoroTargetHours: {
      get() {
        const hours = this.pomodoro.targetFocusMinutes / 60;
        return Number.isInteger(hours) ? hours : Number(hours.toFixed(2));
      },
      set(value) {
        const safeHours = this.normalizePositiveNumber(value, 4);
        const targetFocusMinutes = Math.max(30, Math.round(safeHours * 60));

        this.pomodoro = {
          ...this.pomodoro,
          targetFocusMinutes,
          totalFocusedSeconds: Math.min(this.pomodoro.totalFocusedSeconds, targetFocusMinutes * 60)
        };

        this.persistPomodoro({ forceLocal: true, forceCloud: true });
      }
    },

    pomodoroTargetSeconds() {
      return this.pomodoro.targetFocusMinutes * 60;
    },

    pomodoroTargetHoursLabel() {
      const hours = this.pomodoro.targetFocusMinutes / 60;
      return `${Number.isInteger(hours) ? hours : Number(hours.toFixed(1))}h`;
    },

    pomodoroProgressPercent() {
      if (!this.pomodoroTargetSeconds) return 0;

      const pct = (this.pomodoro.totalFocusedSeconds / this.pomodoroTargetSeconds) * 100;
      return Math.min(Math.max(Math.round(pct), 0), 100);
    },

    pomodoroGoalReached() {
      return this.pomodoro.totalFocusedSeconds >= this.pomodoroTargetSeconds;
    },

    pomodoroModeLabel() {
      switch (this.pomodoro.currentMode) {
        case "shortBreak":
          return "Descanso corto";
        case "longBreak":
          return "Descanso largo";
        default:
          return "Enfoque";
      }
    },

    pomodoroFormattedTime() {
      return this.formatSeconds(this.pomodoro.secondsLeft);
    },

    pomodoroFocusedLabel() {
      return this.formatDurationLabel(this.pomodoro.totalFocusedSeconds);
    },

    pomodoroRemainingLabel() {
      return this.formatDurationLabel(
        Math.max(this.pomodoroTargetSeconds - this.pomodoro.totalFocusedSeconds, 0)
      );
    },

    pomodoroStatusLabel() {
      if (this.pomodoroGoalReached && !this.pomodoro.isRunning) {
        return "Objetivo diario cumplido";
      }

      if (this.pomodoro.isRunning) {
        return `Sesión activa · bloque ${this.pomodoro.completedFocusSessions + 1}`;
      }

      return "Listo para continuar";
    },

    isTradeRegistrationBlocked() {
      return this.emotionChecklist.state === "anxious";
    },

    tradeBlockingReason() {
      if (this.emotionChecklist.state === "anxious") {
        return "Estás ansioso. No puedes operar ni registrar trades hasta volver a estar calmado.";
      }

      if (!this.emotionChecklist.state) {
        return "Marca primero si estás calmado o ansioso antes de registrar un trade.";
      }

      return "Estado validado. Puedes registrar el trade si seguiste tu proceso.";
    },

    emotionChecklistTitle() {
      if (this.emotionChecklist.state === "calm") {
        return "Estado apto para operar";
      }

      if (this.emotionChecklist.state === "anxious") {
        return "Operativa bloqueada";
      }

      return "Confirma tu estado antes de operar";
    },

    emotionChecklistMessage() {
      if (this.emotionChecklist.state === "calm") {
        return "Puedes continuar con disciplina y registrar trades solo si respetaste tu plan.";
      }

      if (this.emotionChecklist.state === "anxious") {
        return "La app bloquea el registro para evitar decisiones impulsivas. Baja pulsaciones y no operes.";
      }

      return "Este filtro emocional es obligatorio para abrir la operativa del día.";
    },

    taskVoiceStatusLabel() {
      return this.taskVoiceMuted ? "Tareas en mudo" : "Voz de tareas activa";
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

    calendarMonthDate() {
      return this.getCalendarMonthDate();
    },

    calendarMonthLabel() {
      const label = this.calendarMonthDate.toLocaleDateString("es-PE", {
        month: "long",
        year: "numeric"
      });

      return label.charAt(0).toUpperCase() + label.slice(1);
    },

    calendarDayNames() {
      return ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    },

    calendarMonthTrades() {
      return this.filteredTrades
        .filter(trade => trade.date?.startsWith(this.currentCalendarMonth))
        .sort((left, right) => left.date.localeCompare(right.date));
    },

    calendarDailyStats() {
      return this.calendarMonthTrades.reduce((accumulator, trade) => {
        const dateKey = trade.date;

        if (!accumulator[dateKey]) {
          accumulator[dateKey] = {
            date: dateKey,
            totalR: 0,
            totalUSD: 0,
            tradeCount: 0,
            wins: 0,
            losses: 0
          };
        }

        const tradeR = this.getSafeR(trade.resultR);
        accumulator[dateKey].totalR += tradeR;
        accumulator[dateKey].totalUSD += Number(trade.resultUSD) || tradeR * this.safeRValue;
        accumulator[dateKey].tradeCount += 1;

        if (tradeR > 0) accumulator[dateKey].wins += 1;
        if (tradeR < 0) accumulator[dateKey].losses += 1;

        return accumulator;
      }, {});
    },

    calendarMonthStats() {
      const days = Object.values(this.calendarDailyStats);
      const totalTrades = this.calendarMonthTrades.length;
      const totalR = days.reduce((sum, day) => sum + day.totalR, 0);
      const totalUSD = days.reduce((sum, day) => sum + day.totalUSD, 0);
      const winningTrades = this.calendarMonthTrades.filter(trade => this.getSafeR(trade.resultR) > 0).length;

      return {
        totalR,
        totalUSD,
        totalTrades,
        activeDays: days.length,
        positiveDays: days.filter(day => day.totalR > 0).length,
        winRate: totalTrades ? Math.round((winningTrades / totalTrades) * 100) : 0
      };
    },

    calendarWeeks() {
      const monthDate = this.calendarMonthDate;
      const year = monthDate.getFullYear();
      const monthIndex = monthDate.getMonth();
      const firstDayOffset = monthDate.getDay();
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const totalSlots = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
      const todayKey = new Date().toISOString().slice(0, 10);
      const weeks = [];

      for (let slot = 0; slot < totalSlots; slot += 7) {
        const days = [];

        for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
          const index = slot + dayOffset;
          const dayNumber = index - firstDayOffset + 1;
          const isCurrentMonth = dayNumber >= 1 && dayNumber <= daysInMonth;

          if (!isCurrentMonth) {
            days.push({
              key: `empty-${slot}-${dayOffset}`,
              isCurrentMonth: false,
              dayNumber: null,
              summary: null,
              isToday: false
            });
            continue;
          }

          const dateKey = `${this.currentCalendarMonth}-${String(dayNumber).padStart(2, "0")}`;
          days.push({
            key: dateKey,
            date: dateKey,
            dayNumber,
            isCurrentMonth: true,
            summary: this.calendarDailyStats[dateKey] || null,
            isToday: dateKey === todayKey
          });
        }

        const weekDaysWithTrades = days.filter(day => day.summary);
        const summary = {
          totalR: weekDaysWithTrades.reduce((sum, day) => sum + day.summary.totalR, 0),
          totalUSD: weekDaysWithTrades.reduce((sum, day) => sum + day.summary.totalUSD, 0),
          activeDays: weekDaysWithTrades.length,
          tradeCount: weekDaysWithTrades.reduce((sum, day) => sum + day.summary.tradeCount, 0)
        };

        weeks.push({
          key: `week-${slot / 7 + 1}`,
          label: `Semana ${slot / 7 + 1}`,
          days,
          summary
        });
      }

      return weeks;
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
    },

    syncStatusLabel() {
      switch (this.syncState) {
        case "loading":
          return "Cargando nube";
        case "pending":
          return "Pendiente de sincronizar";
        case "saving":
          return "Guardando en la nube";
        case "synced":
          return "Sincronizado";
        case "error":
          return "Error de sincronizacion";
        default:
          return "Solo en este dispositivo";
      }
    },

    syncStatusDetail() {
      if (this.syncState === "synced" && this.lastCloudSyncAt) {
        return `Ultima sincronizacion ${this.lastCloudSyncAt}`;
      }

      if (this.syncState === "local") {
        return "Inicia sesion para ver los mismos datos en otros equipos.";
      }

      if (this.syncState === "error") {
        return "No se pudo guardar el ultimo cambio en Firebase.";
      }

      return "";
    }
  },

  watch: {
    tasks: {
      handler(newTasks) {
        try {
          if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
            this.justSavedLocallyAt = Date.now();
          }

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
          if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
            this.justSavedLocallyAt = Date.now();
          }

          localStorage.setItem("nasdaq_trades_curve", JSON.stringify(newTrades));
          this.scheduleCloudSave();
        } catch (error) {
          console.error("Error al guardar trades:", error);
        }
      },
      deep: true
    },

    rValue(newVal) {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      const safeValue = Number(newVal);
      localStorage.setItem(
        "nasdaq_r_value_only_tasks",
        JSON.stringify(safeValue > 0 ? safeValue : 1)
      );
      this.scheduleCloudSave();
    },

    goalUSD(newVal) {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      const safeValue = Number(newVal);
      localStorage.setItem(
        "nasdaq_goal_usd_only_tasks",
        JSON.stringify(safeValue > 0 ? safeValue : 3000)
      );
      this.scheduleCloudSave();
    },

    pomodoroGoalReached(newValue, oldValue) {
      if (newValue && !oldValue && !this.pomodoroGoalCelebrated) {
        this.pomodoroGoalCelebrated = true;
        this.triggerCelebration();
        this.speakText("Completaste las cuatro horas de concentración. Excelente trabajo.");
      }

      if (!newValue) {
        this.pomodoroGoalCelebrated = false;
      }
    }
  },

  mounted() {
    this.loadVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      this.loadVoices();
    };

    this.updateClock();
    this.timer = setInterval(() => {
      this.updateClock();
    }, 1000);

    this.loadLocalData();
    this.handleRedirectResult();

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    }

    this.unsubscribeAuth = onAuthStateChanged(auth, currentUser => {
      this.user = currentUser;
      this.authReady = true;
      this.isSigningIn = false;

      if (currentUser) {
        this.authErrorMessage = "";
        this.authInfoMessage = "";
      }

      if (this.unsubscribeBoard) {
        this.unsubscribeBoard();
        this.unsubscribeBoard = null;
      }

      this.hasReceivedInitialBoardSnapshot = false;

      if (!currentUser) {
        this.syncState = "local";
        this.lastCloudSyncAt = null;
      }

      if (!currentUser) return;

      this.syncState = "loading";

      const boardRef = doc(db, "users", currentUser.uid, "boards", "main");

      this.unsubscribeBoard = onSnapshot(boardRef, snapshot => {
        const isInitialSnapshot = !this.hasReceivedInitialBoardSnapshot;
        this.hasReceivedInitialBoardSnapshot = true;

        if (!snapshot.exists()) {
          this.saveToCloud();
          return;
        }

        const now = Date.now();
        if (!isInitialSnapshot && now - this.justSavedLocallyAt < 3000) return;

        const data = snapshot.data();
        this.isHydratingFromCloud = true;

        this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
        this.trades = Array.isArray(data.trades) ? data.trades : [];
        this.rValue = Number(data.rValue) > 0 ? Number(data.rValue) : 50;
        this.goalUSD = Number(data.goalUSD) > 0 ? Number(data.goalUSD) : 3000;
        this.pomodoro = this.normalizePomodoroState(data.pomodoro);
        this.pomodoroGoalCelebrated = this.pomodoro.totalFocusedSeconds >= this.pomodoroTargetSeconds;
        this.emotionChecklist = this.normalizeEmotionChecklist(data.emotionChecklist);
        this.taskVoiceMuted = Boolean(data.taskVoiceMuted);

        this.isHydratingFromCloud = false;
        this.syncState = "synced";
        this.lastCloudSyncAt = new Date().toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit"
        });
      });
    });
  },

  beforeUnmount() {
    this.persistPomodoro({ forceLocal: true });
    if (this.timer) clearInterval(this.timer);
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    if (this.unsubscribeBoard) this.unsubscribeBoard();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    window.speechSynthesis.onvoiceschanged = null;
  },

  methods: {
    getDefaultEmotionChecklist() {
      return {
        state: ""
      };
    },

    getDefaultPomodoroState() {
      return {
        targetFocusMinutes: 240,
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakEvery: 4,
        currentMode: "focus",
        secondsLeft: 25 * 60,
        isRunning: false,
        completedFocusSessions: 0,
        totalFocusedSeconds: 0,
        lastTickAt: null
      };
    },

    normalizePositiveNumber(value, fallback) {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
    },

    normalizeEmotionChecklist(rawEmotionChecklist) {
      const baseState = this.getDefaultEmotionChecklist();
      const nextEmotionChecklist = {
        ...baseState,
        ...(rawEmotionChecklist || {})
      };

      nextEmotionChecklist.state = ["", "calm", "anxious"].includes(nextEmotionChecklist.state)
        ? nextEmotionChecklist.state
        : "";

      return nextEmotionChecklist;
    },

    persistEmotionChecklist() {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      try {
        localStorage.setItem("nasdaq_emotion_checklist", JSON.stringify(this.emotionChecklist));
      } catch (error) {
        console.error("Error al guardar checklist emocional:", error);
      }

      this.scheduleCloudSave();
    },

    persistTaskVoiceMuted() {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      try {
        localStorage.setItem("nasdaq_task_voice_muted", JSON.stringify(this.taskVoiceMuted));
      } catch (error) {
        console.error("Error al guardar el mute de tareas:", error);
      }

      if (this.taskVoiceMuted) {
        window.speechSynthesis.cancel();
      }

      this.scheduleCloudSave();
    },

    toggleTaskVoiceMuted() {
      this.taskVoiceMuted = !this.taskVoiceMuted;
      this.persistTaskVoiceMuted();
    },

    setEmotionState(state) {
      this.emotionChecklist = this.normalizeEmotionChecklist({ state });

      if (state === "anxious") {
        this.speakText("Estás ansioso. No puedes operar.");
      }

      this.persistEmotionChecklist();
    },

    getPomodoroModeSeconds(mode, pomodoroState = this.pomodoro) {
      if (mode === "shortBreak") return this.normalizePositiveNumber(pomodoroState.shortBreakMinutes, 5) * 60;
      if (mode === "longBreak") return this.normalizePositiveNumber(pomodoroState.longBreakMinutes, 15) * 60;
      return this.normalizePositiveNumber(pomodoroState.focusMinutes, 25) * 60;
    },

    normalizePomodoroState(rawPomodoro) {
      const baseState = this.getDefaultPomodoroState();
      const nextPomodoro = {
        ...baseState,
        ...(rawPomodoro || {})
      };

      nextPomodoro.targetFocusMinutes = this.normalizePositiveNumber(nextPomodoro.targetFocusMinutes, 240);
      nextPomodoro.focusMinutes = this.normalizePositiveNumber(nextPomodoro.focusMinutes, 25);
      nextPomodoro.shortBreakMinutes = this.normalizePositiveNumber(nextPomodoro.shortBreakMinutes, 5);
      nextPomodoro.longBreakMinutes = this.normalizePositiveNumber(nextPomodoro.longBreakMinutes, 15);
      nextPomodoro.longBreakEvery = Math.max(1, Math.round(this.normalizePositiveNumber(nextPomodoro.longBreakEvery, 4)));
      nextPomodoro.currentMode = ["focus", "shortBreak", "longBreak"].includes(nextPomodoro.currentMode)
        ? nextPomodoro.currentMode
        : "focus";
      nextPomodoro.completedFocusSessions = Math.max(0, Math.round(Number(nextPomodoro.completedFocusSessions) || 0));
      nextPomodoro.totalFocusedSeconds = Math.max(0, Math.round(Number(nextPomodoro.totalFocusedSeconds) || 0));
      nextPomodoro.totalFocusedSeconds = Math.min(
        nextPomodoro.totalFocusedSeconds,
        nextPomodoro.targetFocusMinutes * 60
      );
      nextPomodoro.isRunning = Boolean(nextPomodoro.isRunning);
      nextPomodoro.lastTickAt = nextPomodoro.isRunning && Number(nextPomodoro.lastTickAt)
        ? Number(nextPomodoro.lastTickAt)
        : null;

      const maxSecondsForMode = this.getPomodoroModeSeconds(nextPomodoro.currentMode, nextPomodoro);
      const parsedSecondsLeft = Math.round(Number(nextPomodoro.secondsLeft));

      nextPomodoro.secondsLeft = Number.isFinite(parsedSecondsLeft) && parsedSecondsLeft > 0
        ? Math.min(parsedSecondsLeft, maxSecondsForMode)
        : maxSecondsForMode;

      return nextPomodoro;
    },

    formatSeconds(totalSeconds) {
      const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
      const minutes = Math.floor(safeSeconds / 60);
      const seconds = safeSeconds % 60;

      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    },

    formatDurationLabel(totalSeconds) {
      const safeSeconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
      const hours = Math.floor(safeSeconds / 3600);
      const minutes = Math.floor((safeSeconds % 3600) / 60);

      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    },

    persistPomodoro(options = {}) {
      const now = Date.now();
      const { forceLocal = false, forceCloud = false, allowCloud = false } = options;

      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = now;
      }

      if (forceLocal || !this.lastPomodoroLocalSaveAt || now - this.lastPomodoroLocalSaveAt >= 5000) {
        try {
          localStorage.setItem("nasdaq_pomodoro_4h", JSON.stringify(this.pomodoro));
          this.lastPomodoroLocalSaveAt = now;
        } catch (error) {
          console.error("Error al guardar pomodoro local:", error);
        }
      }

      if (forceCloud || (allowCloud && this.user && now - this.lastPomodoroCloudSaveAt >= 30000)) {
        this.lastPomodoroCloudSaveAt = now;
        this.scheduleCloudSave();
      }
    },

    advancePomodoroState(pomodoroState) {
      const nextPomodoro = { ...pomodoroState };

      if (nextPomodoro.currentMode === "focus") {
        nextPomodoro.completedFocusSessions += 1;
        nextPomodoro.currentMode = nextPomodoro.completedFocusSessions % nextPomodoro.longBreakEvery === 0
          ? "longBreak"
          : "shortBreak";
      } else {
        nextPomodoro.currentMode = "focus";
      }

      nextPomodoro.secondsLeft = this.getPomodoroModeSeconds(nextPomodoro.currentMode, nextPomodoro);
      return nextPomodoro;
    },

    getPomodoroTransitionMessage(fromMode, toMode) {
      if (fromMode === "focus" && toMode === "shortBreak") {
        return "Bloque completado. Toma un descanso corto.";
      }

      if (fromMode === "focus" && toMode === "longBreak") {
        return "Bloque completado. Toca un descanso largo.";
      }

      return "Descanso terminado. Vuelve a concentrarte.";
    },

    tickPomodoro() {
      if (!this.pomodoro.isRunning) return;

      const now = Date.now();
      const lastTickAt = Number(this.pomodoro.lastTickAt) || now;
      const elapsedSeconds = Math.floor((now - lastTickAt) / 1000);

      if (elapsedSeconds <= 0) return;

      let nextPomodoro = { ...this.pomodoro };
      let remainingElapsed = elapsedSeconds;
      let latestTransition = null;

      while (remainingElapsed > 0) {
        const step = Math.min(remainingElapsed, nextPomodoro.secondsLeft);

        if (nextPomodoro.currentMode === "focus") {
          nextPomodoro.totalFocusedSeconds = Math.min(
            this.pomodoroTargetSeconds,
            nextPomodoro.totalFocusedSeconds + step
          );
        }

        nextPomodoro.secondsLeft -= step;
        remainingElapsed -= step;

        if (nextPomodoro.secondsLeft <= 0) {
          const previousMode = nextPomodoro.currentMode;
          nextPomodoro = this.advancePomodoroState(nextPomodoro);
          latestTransition = {
            from: previousMode,
            to: nextPomodoro.currentMode
          };
        }
      }

      if (nextPomodoro.totalFocusedSeconds >= this.pomodoroTargetSeconds) {
        nextPomodoro.isRunning = false;
        nextPomodoro.lastTickAt = null;
      } else {
        nextPomodoro.lastTickAt = now;
      }

      this.pomodoro = nextPomodoro;

      if (latestTransition && elapsedSeconds <= 2) {
        this.speakText(this.getPomodoroTransitionMessage(latestTransition.from, latestTransition.to));
      }

      this.persistPomodoro({ allowCloud: true });
    },

    togglePomodoro() {
      if (this.pomodoro.isRunning) {
        this.pomodoro = {
          ...this.pomodoro,
          isRunning: false,
          lastTickAt: null
        };
      } else {
        this.pomodoro = {
          ...this.pomodoro,
          isRunning: true,
          lastTickAt: Date.now()
        };
      }

      this.persistPomodoro({ forceLocal: true, forceCloud: true });
    },

    skipPomodoroPhase() {
      const nextPomodoro = this.advancePomodoroState(this.pomodoro);

      this.pomodoro = {
        ...nextPomodoro,
        isRunning: this.pomodoro.isRunning,
        lastTickAt: this.pomodoro.isRunning ? Date.now() : null
      };

      this.persistPomodoro({ forceLocal: true, forceCloud: true });
    },

    resetPomodoro() {
      const defaultPomodoro = this.getDefaultPomodoroState();

      this.pomodoro = {
        ...defaultPomodoro,
        secondsLeft: this.getPomodoroModeSeconds(defaultPomodoro.currentMode, defaultPomodoro)
      };
      this.pomodoroGoalCelebrated = false;
      this.persistPomodoro({ forceLocal: true, forceCloud: true });
    },

    isGithubPagesProject() {
      return window.location.hostname === "marlonchca3.github.io";
    },

    getCalendarMonthDate(monthKey = this.currentCalendarMonth) {
      const [year, month] = monthKey.split("-").map(Number);
      return new Date(year, month - 1, 1);
    },

    changeCalendarMonth(step) {
      const date = this.getCalendarMonthDate();
      date.setMonth(date.getMonth() + step);
      this.currentCalendarMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    },

    resetCalendarMonth() {
      this.currentCalendarMonth = new Date().toISOString().slice(0, 7);
    },

    formatCalendarValue(value, suffix = "") {
      const formatter = new Intl.NumberFormat("es-PE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });

      return `${formatter.format(value)}${suffix}`;
    },

    getCalendarWinRate(summary) {
      if (!summary || !summary.tradeCount) return 0;
      return Math.round((summary.wins / summary.tradeCount) * 100);
    },

    isLocalNetworkHost() {
      const hostname = window.location.hostname;

      return (
        hostname === "localhost"
        || hostname === "127.0.0.1"
        || hostname.endsWith(".local")
        || /^10\./.test(hostname)
        || /^192\.168\./.test(hostname)
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      );
    },

    shouldWarnForMobileLocalAuth() {
      return this.shouldUseRedirectAuth() && this.isLocalNetworkHost() && !this.isGithubPagesProject();
    },

    shouldUseRedirectAuth() {
      return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
    },

    isInAppBrowser() {
      const userAgent = window.navigator.userAgent || "";

      return /FBAN|FBAV|Instagram|Line|MicroMessenger|wv\)|WebView|GSA|Twitter|TikTok/i.test(userAgent);
    },

    shouldFallbackToRedirect(error) {
      return [
        "auth/popup-blocked",
        "auth/operation-not-supported-in-this-environment",
        "auth/web-storage-unsupported"
      ].includes(error?.code);
    },

    getFriendlyAuthMessage(error, fallbackMessage) {
      switch (error?.code) {
        case "auth/popup-blocked":
          return "El navegador bloqueó la ventana emergente. Se intentará abrir Google con redirección.";
        case "auth/popup-closed-by-user":
          return "Se cerró la ventana de Google antes de completar el inicio de sesión.";
        case "auth/cancelled-popup-request":
          return "Ya hay un intento de inicio de sesión en curso. Espera unos segundos e inténtalo otra vez.";
        case "auth/network-request-failed":
          return "No se pudo conectar con Firebase. Verifica tu conexión e inténtalo de nuevo.";
        case "auth/operation-not-allowed":
          return "Google Sign-In no está habilitado en Firebase Authentication para este proyecto.";
        case "auth/operation-not-supported-in-this-environment":
          return "Este entorno no soporta el inicio de sesión con popup. Se recomienda continuar con redirección.";
        case "auth/web-storage-unsupported":
          return "El navegador no permite el almacenamiento necesario para completar el login con Google. Prueba en Chrome, Edge o Safari fuera del modo privado.";
        case "auth/unauthorized-domain":
          return `El dominio ${window.location.hostname} no está autorizado en Firebase Authentication. En celular usa la URL publicada en GitHub Pages o agrega ese dominio en Firebase si realmente es público.`;
        case "auth/account-exists-with-different-credential":
          return "Ese correo ya existe con otro método de acceso en Firebase.";
        default:
          return error?.message || fallbackMessage;
      }
    },

    handleAuthError(error, fallbackMessage) {
      this.authInfoMessage = "";
      this.authErrorMessage = this.getFriendlyAuthMessage(error, fallbackMessage);
      console.error("Error de autenticación:", error);
    },

    async handleRedirectResult() {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          this.authErrorMessage = "";
          this.authInfoMessage = `Sesión iniciada como ${result.user.displayName || result.user.email || "usuario"}.`;
        }
      } catch (error) {
        this.handleAuthError(
          error,
          "No se pudo completar el inicio de sesión con Google."
        );
      }
    },

    updateClock() {
      const now = new Date();

      this.currentTime = now.toLocaleTimeString("es-PE", {
        hour12: false
      });

      this.todayDate = now.toLocaleDateString("es-PE");
      this.tickPomodoro();

      const seconds = now.getSeconds();
      const minute = now.getMinutes();
      if (seconds === 0 && minute % 5 === 0 && minute !== this.lastSpokenMinute) {
        this.lastSpokenMinute = minute;
        this.announceCompletedTasks();
      }
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
      this.isLoadingLocalData = true;

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

        const savedPomodoro = localStorage.getItem("nasdaq_pomodoro_4h");
        if (savedPomodoro) {
          this.pomodoro = this.normalizePomodoroState(JSON.parse(savedPomodoro));
          this.pomodoroGoalCelebrated = this.pomodoro.totalFocusedSeconds >= this.pomodoroTargetSeconds;
        }

        const savedEmotionChecklist = localStorage.getItem("nasdaq_emotion_checklist");
        if (savedEmotionChecklist) {
          this.emotionChecklist = this.normalizeEmotionChecklist(JSON.parse(savedEmotionChecklist));
        }

        const savedTaskVoiceMuted = localStorage.getItem("nasdaq_task_voice_muted");
        if (savedTaskVoiceMuted) {
          this.taskVoiceMuted = Boolean(JSON.parse(savedTaskVoiceMuted));
        }
      } catch (error) {
        console.error("Error al leer datos locales:", error);
      } finally {
        this.isLoadingLocalData = false;
      }
    },

    getSafeR(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    },


    async signInWithGoogle() {
      let redirectStarted = false;

      this.authErrorMessage = "";
      this.authInfoMessage = "";
      this.isSigningIn = true;

      try {
        if (this.shouldUseRedirectAuth() && this.isInAppBrowser()) {
          this.authErrorMessage = "Ese navegador integrado no soporta bien el login con Google. Abre la app en Chrome, Edge o Safari usando el navegador normal del celular.";
          return;
        }

        if (this.shouldWarnForMobileLocalAuth()) {
          this.authErrorMessage = "En celular no podrás iniciar sesión usando la URL local de tu laptop. Abre la app desde GitHub Pages: https://marlonchca3.github.io/nasdaqCheckList.gitgub.io/.";
          return;
        }

        if (this.shouldUseRedirectAuth()) {
          redirectStarted = true;
          this.authInfoMessage = "Redirigiendo a Google para iniciar sesión...";
          await signInWithRedirect(auth, googleProvider);
          return;
        }

        this.authInfoMessage = "Abriendo Google para iniciar sesión...";
        await signInWithPopup(auth, googleProvider);
        this.authInfoMessage = "";
      } catch (error) {
        if (this.shouldFallbackToRedirect(error)) {
          try {
            redirectStarted = true;
            this.authErrorMessage = "";
            this.authInfoMessage = "El navegador requiere redirección. Abriendo Google...";
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirectError) {
            this.handleAuthError(
              redirectError,
              "No se pudo redirigir a Google para iniciar sesión."
            );
            return;
          }
        }

        this.handleAuthError(
          error,
          "No se pudo iniciar sesión con Google."
        );
      } finally {
        if (!redirectStarted) {
          this.isSigningIn = false;
        }
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

       this.syncState = "pending";

      this.saveTimer = setTimeout(() => {
        this.saveToCloud();
      }, 500);
    },

    async saveToCloud() {
      if (!this.user || this.isHydratingFromCloud) return;

      this.isHydratingFromCloud = true;
      this.syncState = "saving";

      try {
        const boardRef = doc(db, "users", this.user.uid, "boards", "main");

        await setDoc(
          boardRef,
          {
            tasks: this.tasks,
            trades: this.trades,
            pomodoro: this.pomodoro,
            emotionChecklist: this.emotionChecklist,
            taskVoiceMuted: this.taskVoiceMuted,
            rValue: this.safeRValue,
            goalUSD: this.safeGoalUSD,
            updatedAt: serverTimestamp(),
            userEmail: this.user.email || "",
            userName: this.user.displayName || ""
          },
          { merge: true }
        );

        this.justSavedLocallyAt = Date.now();
        this.syncState = "synced";
        this.lastCloudSyncAt = new Date().toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit"
        });
      } catch (error) {
        this.syncState = "error";
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
      if (!this.emotionChecklist.state || this.isTradeRegistrationBlocked) {
        alert(this.tradeBlockingReason);
        return;
      }

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

    announceCompletedTasks(force = false) {
      if (this.taskVoiceMuted && !force) {
        return;
      }

      const completedTasks = this.tasks.filter(task => task.done);

      if (completedTasks.length === 0) {
        this.speakText("No hay tareas completadas para anunciar.");
        return;
      }

      const taskList = completedTasks.map(task => task.text).join(", ");
      const message = `Tareas completadas: ${taskList}. Total: ${completedTasks.length} de ${this.tasks.length} tareas.`;

      this.speakText(message);
    },

    loadVoices() {
      const voices = window.speechSynthesis.getVoices();
      this.availableVoices = voices;
    },

    speakText(text) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-MX";
      utterance.rate = 0.9;
      utterance.pitch = 0.95;
      utterance.volume = 1.0;

      const voices = this.availableVoices.length > 0 ? this.availableVoices : window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(voice => voice.lang.startsWith("es"));
      
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      window.speechSynthesis.speak(utterance);
    },

    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }
  }
};