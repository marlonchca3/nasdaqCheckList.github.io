<template>
  <div class="app-shell" :class="{ 'light-mode': !isDarkMode }">
    <div class="bg-grid"></div>

    <main class="dashboard">
      <section class="auth-bar">
        <div class="auth-left">
          <p class="eyebrow">Cuenta</p>
          <strong v-if="user">
            {{ user.displayName || user.email }}
          </strong>
          <span v-else>No has iniciado sesión</span>
        </div>

        <div class="auth-right">
          <button class="theme-toggle-btn" @click="toggleTheme">
            {{ isDarkMode ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>

          <button v-if="!user" class="primary-btn" @click="signInWithGoogle">
            Ingresar con Google
          </button>

          <button v-else class="secondary-btn" @click="signOutUser">
            Cerrar sesión
          </button>
        </div>
      </section>

      <section class="hero-card">
        <div class="hero-top">
          <div>
            <p class="eyebrow">Trading Workflow</p>
            <h1>Check List Nasdaq</h1>
            <p class="hero-text">
              Checklist profesional con tareas, curva de R y guardado en la nube por usuario.
            </p>
          </div>

          <div class="market-badge">
            <span class="dot-live"></span>
            <span>NASDAQ · 5 MIN</span>
          </div>
        </div>

        <div class="hero-stats">
          <div class="stat-card">
            <span class="stat-label">Hora</span>
            <strong>{{ currentTime }}</strong>
          </div>

          <div class="stat-card">
            <span class="stat-label">Fecha</span>
            <strong>{{ todayDate }}</strong>
          </div>

          <div class="stat-card">
            <span class="stat-label">Tareas</span>
            <strong>{{ completedCount }}/{{ tasks.length }}</strong>
          </div>

          <div class="stat-card">
            <span class="stat-label">Progreso meta</span>
            <strong>{{ Number(goalProgressPercent || 0).toFixed(0) }}%</strong>
          </div>
        </div>
      </section>

      <section class="grid-layout">
        <section class="panel panel-main">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Checklist</p>
              <h2>Tareas del día</h2>
            </div>

            <div class="header-pills">
              <span class="pill">Completadas {{ completedCount }}</span>
              <span class="pill">Pendientes {{ tasks.length - completedCount }}</span>
            </div>
          </div>

         <div class="task-form">
  <input
    v-model="newTask"
    type="text"
    placeholder="Ejemplo: Esperar confirmación en zona"
    @keyup.enter="addTask"
  />

  <input
    v-model.number="newTaskR"
    type="number"
    min="0.25"
    step="0.25"
    inputmode="decimal"
    placeholder="1R"
    title="R por tarea"
  />

  <button type="button" class="primary-btn" @click="addTask">
    Agregar
  </button>
</div>

          <div class="progress-wrap">
            <div class="progress-labels">
              <span>Progreso</span>
              <strong>{{ progressPercent }}%</strong>
            </div>

            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
          </div>

          <draggable
            v-model="tasks"
            item-key="id"
            ghost-class="ghost-card"
            chosen-class="chosen-card"
            drag-class="drag-card"
            handle=".drag-handle"
            :animation="200"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <article class="task-card" :class="{ done: element.done }">
                <div class="task-left">
                  <button type="button" class="drag-handle" title="Arrastrar">☰</button>

                  <label class="task-check">
                    <input v-model="element.done" type="checkbox" />
                    <span></span>
                  </label>

                  <div class="task-copy">
                    <p>{{ element.text }}</p>
                    <small>{{ Number(element.r || 0).toFixed(2) }}R</small>
                  </div>
                </div>

                <button
                  type="button"
                  class="danger-icon"
                  @click="removeTask(element.id)"
                >
                  ✕
                </button>
              </article>
            </template>
          </draggable>

          <div class="task-actions">
            <button class="secondary-btn" @click="clearCompleted">
              Borrar completadas
            </button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Objetivo</p>
              <h2>Meta de evaluación</h2>
            </div>
          </div>

          <div class="metric-grid">
            <div class="metric-box">
              <span>1R ($)</span>
              <input v-model.number="rValue" type="number" min="0" />
            </div>

            <div class="metric-box">
              <span>Objetivo ($)</span>
              <input v-model.number="goalUSD" type="number" min="0" />
            </div>
          </div>

          <div class="goal-cards">
            <article class="goal-card">
              <span>Total R</span>
              <strong>{{ Number(totalR || 0).toFixed(2) }}R</strong>
            </article>

            <article class="goal-card">
              <span>Total USD</span>
              <strong>${{ Number(totalUSD || 0).toFixed(2) }}</strong>
            </article>

            <article class="goal-card">
              <span>Restan R</span>
              <strong>{{ Number(remainingR || 0).toFixed(2) }}R</strong>
            </article>

            <article class="goal-card">
              <span>Restan USD</span>
              <strong>${{ Number(remainingUSD || 0).toFixed(2) }}</strong>
            </article>
          </div>

          <div class="progress-wrap">
            <div class="progress-labels">
              <span>Avance hacia meta</span>
              <strong>{{ Number(targetProgressPercent || 0).toFixed(0) }}%</strong>
            </div>

            <div class="progress-bar">
              <div
                class="progress-fill progress-fill-goal"
                :style="{ width: goalProgressPercent + '%' }"
              ></div>
            </div>
          </div>

          <div class="stats-mini-grid">
            <article class="mini-stat">
              <span>Trades hoy</span>
              <strong>{{ todaysTrades }}</strong>
            </article>

            <article class="mini-stat">
              <span>R hoy</span>
              <strong>{{ Number(todaysR || 0).toFixed(2) }}</strong>
            </article>

            <article class="mini-stat">
              <span>Win Rate</span>
              <strong>{{ Number(winRate || 0).toFixed(0) }}%</strong>
            </article>
          </div>
        </section>
      </section>

      <section class="panel trade-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Registro</p>
            <h2>Trades</h2>
          </div>

          <div class="trade-filters">
            <select v-model="sessionFilter">
              <option>All</option>
              <option>London</option>
              <option>New York</option>
              <option>Asia</option>
            </select>
          </div>
        </div>

        <div class="trade-form-grid">
          <input v-model="tradeForm.date" type="date" />

          <select v-model="tradeForm.session">
            <option disabled value="">Sesión</option>
            <option>London</option>
            <option>New York</option>
            <option>Asia</option>
          </select>

          <select v-model="tradeForm.direction">
            <option disabled value="">Dirección</option>
            <option>Long</option>
            <option>Short</option>
          </select>

          <input v-model="tradeForm.setup" type="text" placeholder="Setup" />

          <input
            v-model.number="tradeForm.resultR"
            type="number"
            step="any"
            placeholder="Resultado R"
          />

          <input v-model="tradeForm.note" type="text" placeholder="Nota" />
        </div>

        <div class="trade-form-actions">
          <button class="primary-btn" @click="saveTrade">
            {{ isEditing ? "Actualizar trade" : "Guardar trade" }}
          </button>

          <button class="secondary-btn" @click="resetTradeForm">
            Limpiar
          </button>
        </div>

        <div class="table-wrap">
          <table class="trade-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Sesión</th>
                <th>Dirección</th>
                <th>Setup</th>
                <th>R</th>
                <th>USD</th>
                <th>Nota</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="trade in filteredTrades" :key="trade.id">
                <td>{{ trade.date }}</td>
                <td>{{ trade.session }}</td>
                <td>{{ trade.direction }}</td>
                <td>{{ trade.setup }}</td>
                <td :class="{ positive: trade.resultR > 0, negative: trade.resultR < 0 }">
                  {{ Number(trade.resultR || 0).toFixed(2) }}
                </td>
                <td :class="{ positive: trade.resultUSD > 0, negative: trade.resultUSD < 0 }">
                  ${{ Number(trade.resultUSD || 0).toFixed(2) }}
                </td>
                <td>{{ trade.note }}</td>
                <td class="actions-cell">
                  <button class="tiny-btn" @click="editTrade(trade)">Editar</button>
                  <button class="tiny-btn danger" @click="removeTrade(trade.id)">Borrar</button>
                </td>
              </tr>

              <tr v-if="filteredTrades.length === 0">
                <td colspan="8" class="empty-row">Aún no hay trades registrados</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel chart-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Curva</p>
            <h2>Curva de R</h2>
          </div>
        </div>

        <div class="chart-wrap">
          <svg viewBox="0 0 1000 260" class="curve-svg" preserveAspectRatio="none">
            <line
              v-if="zeroLineY !== null"
              x1="0"
              :y1="zeroLineY"
              x2="1000"
              :y2="zeroLineY"
              class="zero-line"
            />

            <polyline
              v-if="curvePolyline"
              :points="curvePolyline"
              fill="none"
              class="curve-line"
            />

            <circle
              v-for="(point, index) in curvePoints"
              :key="index"
              :cx="point.x"
              :cy="point.y"
              r="4"
              class="curve-point"
            />
          </svg>
        </div>
      </section>

      <div v-if="showCelebration" class="celebration-overlay">
        <div class="confetti">🎉 🎉 🎉</div>
      </div>
    </main>
  </div>
</template>

<script>
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
      newTaskR: 1,
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
            ...task,
            r: this.getSafeR(task.r)
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
        if (now - this.justSavedLocallyAt < 1500) return;

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
      } catch (error) {
        console.error("Error al guardar en Firebase:", error);
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
        done: false,
        r: this.getSafeR(this.newTaskR || 1)
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
      this.newTaskR = 1;

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
</script>

<style scoped src="../styles/NasdaqFiboChecklist.css"></style>
