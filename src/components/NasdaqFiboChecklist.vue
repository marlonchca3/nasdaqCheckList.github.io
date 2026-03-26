<template>
  <div class="app-shell">
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
              step="0.25"
              placeholder="R"
            />
            <button class="primary-btn" @click="addTask">Agregar</button>
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
          >
            <template #item="{ element }">
              <article class="task-card" :class="{ done: element.done }">
                <div class="task-left">
                  <button class="drag-handle" title="Arrastrar">☰</button>

                  <label class="task-check">
                    <input v-model="element.done" type="checkbox" />
                    <span></span>
                  </label>

                  <div class="task-copy">
                    <p>{{ element.text }}</p>
                    <small>{{ Number(element.r || 0).toFixed(2) }}R</small>
                  </div>
                </div>

                <button class="danger-icon" @click="removeTask(element.id)">✕</button>
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
              <input v-model.number="rValue" type="number" min="1" />
            </div>

            <div class="metric-box">
              <span>Objetivo ($)</span>
              <input v-model.number="goalUSD" type="number" min="1" />
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

            <article class="mini-stat">
              <span>Límite diario</span>
              <strong :class="{ bad: dailyLimitReached }">{{ dailyMaxTrades }}</strong>
            </article>

            <article class="mini-stat">
              <span>Loss límite</span>
              <strong :class="{ bad: dailyLossLimitReached }">
                {{ Number(dailyMaxLossR || 0).toFixed(1) }}R
              </strong>
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
            step="0.25"
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
      newTask: "",
      newTaskR: 1,
      rValue: 50,
      goalUSD: 3000,
      tasks: [],
      trades: [],
      showCelebration: false,
      celebrationPlayed: false,
      audioContext: null,

      user: null,
      authReady: false,
      isHydratingFromCloud: false,
      saveTimer: null,
      unsubscribeAuth: null,
      unsubscribeBoard: null,

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
    currentTime() {
      return new Date().toLocaleTimeString();
    },

    todayDate() {
      return new Date().toLocaleDateString();
    },

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
      return 5;
    },

    dailyMaxLossR() {
      return -3;
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
          const normalizedTasks = newTasks.map(task => ({
            ...task,
            r: this.getSafeR(task.r)
          }));

          localStorage.setItem(
            "nasdaq_tasks_professional",
            JSON.stringify(normalizedTasks)
          );

          if (this.allCompleted && !this.celebrationPlayed) {
            this.triggerCelebration();
          }

          if (!this.allCompleted) {
            this.celebrationPlayed = false;
          }

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
      const safeValue = Number(newVal);
      localStorage.setItem(
        "nasdaq_r_value_only_tasks",
        JSON.stringify(safeValue > 0 ? safeValue : 1)
      );
      this.scheduleCloudSave();
    },

    goalUSD(newVal) {
      const safeValue = Number(newVal);
      localStorage.setItem(
        "nasdaq_goal_usd_only_tasks",
        JSON.stringify(safeValue > 0 ? safeValue : 3000)
      );
      this.scheduleCloudSave();
    }
  },

  mounted() {
    this.loadLocalData();

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
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    if (this.unsubscribeBoard) this.unsubscribeBoard();
    if (this.saveTimer) clearTimeout(this.saveTimer);
  },

  methods: {
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
      if (!text) return;

      this.tasks.push({
        id: Date.now() + Math.random(),
        text,
        done: false,
        r: this.getSafeR(this.newTaskR)
      });

      this.newTask = "";
      this.newTaskR = 1;
    },

    removeTask(id) {
      this.tasks = this.tasks.filter(task => task.id !== id);
    },

    clearCompleted() {
      this.tasks = this.tasks.filter(task => !task.done);
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
        this.trades.push(tradePayload);
      }

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
    }
  }
};
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.app-shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.15), transparent 35%),
    linear-gradient(135deg, #08111f 0%, #0b1728 45%, #07101d 100%);
  color: #e5eefb;
  font-family: Inter, Arial, sans-serif;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.dashboard {
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}

.auth-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.12);
  backdrop-filter: blur(10px);
}

.auth-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.auth-left strong {
  color: #ffffff;
  font-size: 16px;
}

.auth-left span {
  color: #95a8c2;
  font-size: 14px;
}

.auth-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-card,
.panel {
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(8, 17, 31, 0.78);
  backdrop-filter: blur(14px);
  border-radius: 24px;
  box-shadow: 0 20px 50px rgba(2, 8, 23, 0.35);
}

.hero-card {
  padding: 26px;
  margin-bottom: 20px;
}

.hero-top,
.panel-header,
.progress-labels,
.task-left,
.task-actions,
.trade-form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.hero-text {
  color: #a8bbd5;
  max-width: 620px;
}

.eyebrow {
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #7dd3fc;
  font-size: 12px;
  margin: 0 0 8px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 36px;
  line-height: 1.05;
  margin-bottom: 10px;
}

h2 {
  font-size: 22px;
}

.market-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border-radius: 999px;
  padding: 10px 14px;
  background: rgba(14, 116, 144, 0.16);
  border: 1px solid rgba(125, 211, 252, 0.28);
  color: #d9f4ff;
  font-size: 13px;
  font-weight: 700;
}

.dot-live {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.15);
}

.hero-stats,
.metric-grid,
.goal-cards,
.stats-mini-grid {
  display: grid;
  gap: 14px;
}

.hero-stats {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 22px;
}

.stat-card,
.metric-box,
.goal-card,
.mini-stat {
  padding: 18px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.stat-label,
.goal-card span,
.mini-stat span,
.metric-box span {
  display: block;
  font-size: 12px;
  color: #8fa6c3;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.stat-card strong,
.goal-card strong,
.mini-stat strong {
  font-size: 24px;
  color: #fff;
}

.metric-box input,
.task-form input,
.trade-form-grid input,
.trade-form-grid select,
.trade-filters select {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(6, 14, 26, 0.9);
  color: #e5eefb;
  border-radius: 14px;
  padding: 12px 14px;
  outline: none;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 20px;
  margin-bottom: 20px;
}

.panel {
  padding: 22px;
}

.header-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(37, 99, 235, 0.16);
  color: #dbeafe;
  border: 1px solid rgba(96, 165, 250, 0.18);
  font-size: 12px;
}

.task-form {
  display: grid;
  grid-template-columns: 1fr 120px 140px;
  gap: 12px;
  margin-top: 18px;
  margin-bottom: 18px;
}

.progress-wrap {
  margin-bottom: 18px;
}

.progress-bar {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.85);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #38bdf8, #22c55e);
  transition: width 0.3s ease;
}

.progress-fill-goal {
  background: linear-gradient(90deg, #f59e0b, #ef4444);
}

.task-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 15px 16px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.1);
  margin-bottom: 12px;
}

.task-card.done {
  opacity: 0.72;
  border-color: rgba(34, 197, 94, 0.28);
}

.task-copy p {
  font-size: 15px;
  color: #f8fbff;
  margin-bottom: 4px;
}

.task-copy small {
  color: #8fa6c3;
}

.task-check {
  position: relative;
  width: 22px;
  height: 22px;
}

.task-check input {
  position: absolute;
  opacity: 0;
  inset: 0;
}

.task-check span {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(8, 17, 31, 0.8);
}

.task-check input:checked + span {
  background: #22c55e;
  border-color: #22c55e;
}

.drag-handle,
.danger-icon,
.tiny-btn,
.primary-btn,
.secondary-btn {
  border: none;
  cursor: pointer;
  transition: 0.2s ease;
}

.drag-handle {
  background: transparent;
  color: #9fb4cf;
  font-size: 18px;
}

.danger-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.14);
  color: #fecaca;
}

.primary-btn,
.secondary-btn {
  border-radius: 14px;
  padding: 12px 16px;
  font-weight: 700;
}

.primary-btn {
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: white;
}

.secondary-btn {
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.primary-btn:hover,
.secondary-btn:hover,
.tiny-btn:hover,
.danger-icon:hover {
  transform: translateY(-1px);
}

.trade-panel,
.chart-panel {
  margin-bottom: 20px;
}

.trade-form-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
  margin-bottom: 14px;
}

.table-wrap {
  overflow-x: auto;
  margin-top: 14px;
}

.trade-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 920px;
}

.trade-table th,
.trade-table td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  text-align: left;
  font-size: 14px;
}

.trade-table th {
  color: #9fb4cf;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.tiny-btn {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
}

.tiny-btn.danger {
  background: rgba(239, 68, 68, 0.14);
  color: #fecaca;
}

.empty-row {
  text-align: center;
  color: #8fa6c3;
  padding: 18px 10px;
}

.chart-wrap {
  width: 100%;
  height: 280px;
}

.curve-svg {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.7);
}

.curve-line {
  stroke: #38bdf8;
  stroke-width: 3;
}

.curve-point {
  fill: #f8fafc;
  stroke: #38bdf8;
  stroke-width: 2;
}

.zero-line {
  stroke: rgba(148, 163, 184, 0.25);
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
}

.positive {
  color: #4ade80;
  font-weight: 700;
}

.negative,
.bad {
  color: #f87171;
  font-weight: 700;
}

.celebration-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  display: grid;
  place-items: center;
  z-index: 100;
}

.confetti {
  font-size: 42px;
  animation: pop 0.5s ease;
}

@keyframes pop {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.ghost-card {
  opacity: 0.4;
}

.chosen-card {
  transform: scale(1.01);
}

.drag-card {
  transform: rotate(1deg);
}

@media (max-width: 1100px) {
  .grid-layout {
    grid-template-columns: 1fr;
  }

  .hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .trade-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .dashboard {
    padding: 18px 12px 32px;
  }

  h1 {
    font-size: 28px;
  }

  .hero-stats,
  .metric-grid,
  .goal-cards,
  .stats-mini-grid,
  .task-form,
  .trade-form-grid {
    grid-template-columns: 1fr;
  }

  .auth-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .auth-right {
    width: 100%;
  }

  .hero-top,
  .panel-header,
  .trade-form-actions,
  .task-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>