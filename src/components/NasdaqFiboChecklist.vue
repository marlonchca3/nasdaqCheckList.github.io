<template>
  <div class="app-shell">
    <div class="bg-grid"></div>

    <main class="dashboard">
      <section class="hero-card">
        <div class="hero-top">
          <div>
            <p class="eyebrow">Trading Workflow</p>
            <h1>Nasdaq 5M Task Board + 60R Tracker</h1>
            <p class="hero-text">
              Organiza tareas, registra trades, edítalos, filtra por sesión y controla tu curva de R.
            </p>
          </div>

          <div class="market-badge">
            <span class="dot-live"></span>
            <span>NASDAQ · 5 MIN</span>
          </div>
        </div>

        <div class="hero-stats">
          <div class="stat-card">
            <span class="stat-label">Meta total</span>
            <strong>{{ targetR }}R</strong>
            <small>${{ targetUSD.toFixed(0) }}</small>
          </div>

          <div class="stat-card">
            <span class="stat-label">Llevas</span>
            <strong>{{ totalR.toFixed(1) }}R</strong>
            <small>${{ totalUSD.toFixed(0) }}</small>
          </div>

          <div class="stat-card">
            <span class="stat-label">Falta</span>
            <strong>{{ remainingR.toFixed(1) }}R</strong>
            <small>${{ remainingUSD.toFixed(0) }}</small>
          </div>

          <div class="stat-card">
            <span class="stat-label">Hora local</span>
            <strong>{{ currentTime }}</strong>
            <small>{{ todayDate }}</small>
          </div>
        </div>
      </section>

      <section class="board-grid">
        <div class="panel panel-main">
          <div class="panel-header">
            <div>
              <h2>Task Manager</h2>
              <p>Agrega tareas, arrástralas para reordenarlas y todo se guarda automáticamente.</p>
            </div>
          </div>

          <div class="task-entry">
            <input
              v-model="newTask"
              @keyup.enter="addTask"
              type="text"
              placeholder="Ejemplo: Esperar retroceso a 61.8% antes de entrar..."
            />
            <button class="primary-btn" @click="addTask">Agregar</button>
          </div>

          <div v-if="tasks.length === 0" class="empty-state">
            <div class="empty-icon">📈</div>
            <h3>No tienes tasks todavía</h3>
            <p>Crea tu primera tarea para comenzar tu sesión de Nasdaq 5 minutos.</p>
          </div>

          <draggable
            v-else
            v-model="tasks"
            item-key="id"
            handle=".drag-handle"
            animation="220"
            ghost-class="ghost-task"
            chosen-class="chosen-task"
            drag-class="drag-task"
            class="task-list"
          >
            <template #item="{ element: task }">
              <article class="task-card" :class="{ completed: task.done }">
                <div class="task-left">
                  <button
                    class="drag-handle"
                    type="button"
                    title="Arrastrar tarea"
                    aria-label="Arrastrar tarea"
                  >
                    ☰
                  </button>

                  <input type="checkbox" v-model="task.done" />

                  <div class="task-content">
                    <span class="task-text">{{ task.text }}</span>
                    <small>{{ task.done ? 'Completada' : 'En espera' }}</small>
                  </div>
                </div>

                <button class="danger-btn" @click="removeTask(task.id)">
                  Eliminar
                </button>
              </article>
            </template>
          </draggable>

          <div v-if="tasks.length > 0" class="task-footer">
            <div class="progress-wrap">
              <div class="progress-head">
                <span>Progreso tareas</span>
                <span>{{ progressPercent }}%</span>
              </div>

              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
            </div>

            <button class="secondary-btn" @click="clearCompleted">
              Eliminar completadas
            </button>
          </div>
        </div>

        <aside class="panel panel-side">
          <div class="mini-panel">
            <h3>Progreso a 60R</h3>

            <div class="summary-box">
              <div class="summary-row">
                <span>1R</span>
                <strong>${{ rValue.toFixed(0) }}</strong>
              </div>
              <div class="summary-row">
                <span>Objetivo</span>
                <strong>{{ targetR }}R</strong>
              </div>
              <div class="summary-row">
                <span>Acumulado</span>
                <strong>{{ totalR.toFixed(1) }}R</strong>
              </div>
              <div class="summary-row">
                <span>En dólares</span>
                <strong>${{ totalUSD.toFixed(0) }}</strong>
              </div>
            </div>

            <div class="progress-wrap top-space">
              <div class="progress-head">
                <span>Avance global</span>
                <span>{{ targetProgressPercent }}%</span>
              </div>

              <div class="progress-bar">
                <div class="progress-fill money-fill" :style="{ width: targetProgressPercent + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="mini-panel">
            <h3>Métricas</h3>
            <div class="summary-box">
              <div class="summary-row">
                <span>Total trades</span>
                <strong>{{ trades.length }}</strong>
              </div>
              <div class="summary-row">
                <span>Win rate</span>
                <strong>{{ winRate }}%</strong>
              </div>
              <div class="summary-row">
                <span>Trades hoy</span>
                <strong>{{ todaysTrades }}</strong>
              </div>
              <div class="summary-row">
                <span>R hoy</span>
                <strong>{{ todaysR.toFixed(1) }}R</strong>
              </div>
            </div>
          </div>

          <div class="mini-panel">
            <h3>Reglas del día</h3>
            <div class="summary-box">
              <div class="summary-row">
                <span>Máx trades/día</span>
                <strong>{{ dailyMaxTrades }}</strong>
              </div>
              <div class="summary-row">
                <span>Stop diario</span>
                <strong>{{ dailyMaxLossR.toFixed(1) }}R</strong>
              </div>
              <div class="summary-row">
                <span>Estado</span>
                <strong :class="{ dangerText: dailyLimitReached || dailyLossLimitReached, okText: !dailyLimitReached && !dailyLossLimitReached }">
                  {{ dailyLimitReached || dailyLossLimitReached ? 'Detenerse' : 'Operable' }}
                </strong>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section class="panel trades-panel">
        <div class="panel-header trade-header">
          <div>
            <h2>Registro de trades</h2>
            <p>Registra y edita tus operaciones en R. La app las convierte a dólares automáticamente.</p>
          </div>

          <div class="filter-box">
            <label>Filtrar sesión</label>
            <select v-model="sessionFilter">
              <option value="All">Todas</option>
              <option value="London">London</option>
              <option value="New York">New York</option>
              <option value="Asia">Asia</option>
            </select>
          </div>
        </div>

        <div class="trade-form-grid">
          <div class="field">
            <label>Fecha</label>
            <input v-model="tradeForm.date" type="date" />
          </div>

          <div class="field">
            <label>Sesión</label>
            <select v-model="tradeForm.session">
              <option value="">Selecciona</option>
              <option>London</option>
              <option>New York</option>
              <option>Asia</option>
            </select>
          </div>

          <div class="field">
            <label>Dirección</label>
            <select v-model="tradeForm.direction">
              <option value="">Selecciona</option>
              <option>Long</option>
              <option>Short</option>
            </select>
          </div>

          <div class="field">
            <label>Setup</label>
            <input v-model="tradeForm.setup" type="text" placeholder="Ej: Retroceso Fibo 61.8" />
          </div>

          <div class="field">
            <label>Resultado en R</label>
            <input v-model.number="tradeForm.resultR" type="number" step="0.1" placeholder="Ej: 2 o -1" />
          </div>

          <div class="field">
            <label>Nota</label>
            <input v-model="tradeForm.note" type="text" placeholder="Ej: buena confirmación" />
          </div>
        </div>

        <div class="trade-actions">
          <button
            class="primary-btn"
            @click="saveTrade"
            :disabled="!isEditing && (dailyLimitReached || dailyLossLimitReached)"
          >
            {{ isEditing ? 'Guardar cambios' : 'Agregar trade' }}
          </button>

          <button class="secondary-btn" @click="resetTradeForm">
            {{ isEditing ? 'Cancelar edición' : 'Limpiar' }}
          </button>
        </div>

        <p v-if="!isEditing && dailyLimitReached" class="warning-banner">
          Llegaste al máximo de trades del día.
        </p>
        <p v-if="!isEditing && dailyLossLimitReached" class="danger-banner">
          Alcanzaste tu stop diario en R. Deberías dejar de operar hoy.
        </p>

        <div class="curve-panel top-space">
          <div class="curve-header">
            <h3>Curva de R</h3>
            <span>{{ filteredTrades.length }} trades filtrados</span>
          </div>

          <div v-if="curvePoints.length > 1" class="chart-wrap">
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
                :points="curvePolyline"
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

          <div v-else class="empty-state compact-empty">
            <h3>Aún no hay suficientes trades</h3>
            <p>Agrega al menos 2 trades para ver la curva de R.</p>
          </div>
        </div>

        <div v-if="filteredTrades.length === 0" class="empty-state top-space">
          <div class="empty-icon">🧾</div>
          <h3>No hay trades para este filtro</h3>
          <p>Agrega un trade o cambia la sesión seleccionada.</p>
        </div>

        <div v-else class="trades-table-wrap top-space">
          <table class="trades-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Sesión</th>
                <th>Dir.</th>
                <th>Setup</th>
                <th>R</th>
                <th>$</th>
                <th>Nota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trade in filteredTrades" :key="trade.id">
                <td>{{ trade.date }}</td>
                <td>{{ trade.session }}</td>
                <td>{{ trade.direction }}</td>
                <td>{{ trade.setup }}</td>
                <td :class="trade.resultR >= 0 ? 'positiveText' : 'negativeText'">
                  {{ Number(trade.resultR).toFixed(1) }}R
                </td>
                <td :class="trade.resultUSD >= 0 ? 'positiveText' : 'negativeText'">
                  ${{ Number(trade.resultUSD).toFixed(0) }}
                </td>
                <td>{{ trade.note }}</td>
                <td class="action-cell">
                  <button class="edit-btn" @click="editTrade(trade)">Editar</button>
                  <button class="danger-btn small-btn" @click="removeTrade(trade.id)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <transition name="celebration">
      <div v-if="showCelebration" class="celebration-overlay">
        <div class="celebration-box">
          <div class="celebration-icon">🎉</div>
          <h2>¡Excelente trabajo!</h2>
          <p>Completaste todas tus tareas de la sesión.</p>
        </div>

        <div class="confetti confetti-1"></div>
        <div class="confetti confetti-2"></div>
        <div class="confetti confetti-3"></div>
        <div class="confetti confetti-4"></div>
        <div class="confetti confetti-5"></div>
        <div class="confetti confetti-6"></div>
        <div class="confetti confetti-7"></div>
        <div class="confetti confetti-8"></div>
      </div>
    </transition>
  </div>
</template>

<script>
import draggable from "vuedraggable";

export default {
  name: "App",
  components: {
    draggable
  },
  data() {
    return {
      newTask: "",
      tasks: [],
      trades: [],
      showCelebration: false,
      celebrationPlayed: false,
      audioContext: null,
      currentTime: "",
      todayDate: "",
      clockInterval: null,

      rValue: 50,
      targetR: 60,
      dailyMaxTrades: 5,
      dailyMaxLossR: 3,

      sessionFilter: "All",
      editingTradeId: null,

      tradeForm: {
        date: "",
        session: "",
        direction: "",
        setup: "",
        resultR: null,
        note: ""
      }
    };
  },
  computed: {
    completedCount() {
      return this.tasks.filter(task => task.done).length;
    },
    pendingCount() {
      return this.tasks.filter(task => !task.done).length;
    },
    allCompleted() {
      return this.tasks.length > 0 && this.tasks.every(task => task.done);
    },
    progressPercent() {
      if (!this.tasks.length) return 0;
      return Math.round((this.completedCount / this.tasks.length) * 100);
    },

    totalR() {
      return this.trades.reduce((sum, trade) => sum + Number(trade.resultR || 0), 0);
    },
    totalUSD() {
      return this.totalR * this.rValue;
    },
    targetUSD() {
      return this.targetR * this.rValue;
    },
    remainingR() {
      return Math.max(this.targetR - this.totalR, 0);
    },
    remainingUSD() {
      return this.remainingR * this.rValue;
    },
    targetProgressPercent() {
      if (!this.targetR) return 0;
      return Math.min(Math.max(Math.round((this.totalR / this.targetR) * 100), 0), 100);
    },
    winningTrades() {
      return this.trades.filter(trade => Number(trade.resultR) > 0).length;
    },
    winRate() {
      if (!this.trades.length) return 0;
      return Math.round((this.winningTrades / this.trades.length) * 100);
    },

    sortedTrades() {
      return [...this.trades].sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id - a.id;
      });
    },

    filteredTrades() {
      if (this.sessionFilter === "All") return this.sortedTrades;
      return this.sortedTrades.filter(trade => trade.session === this.sessionFilter);
    },

    todaysTrades() {
      const today = this.getTodayString();
      return this.trades.filter(trade => trade.date === today).length;
    },
    todaysR() {
      const today = this.getTodayString();
      return this.trades
        .filter(trade => trade.date === today)
        .reduce((sum, trade) => sum + Number(trade.resultR || 0), 0);
    },
    dailyLimitReached() {
      return this.todaysTrades >= this.dailyMaxTrades;
    },
    dailyLossLimitReached() {
      return this.todaysR <= -this.dailyMaxLossR;
    },

    isEditing() {
      return this.editingTradeId !== null;
    },

    curveData() {
      const trades = [...this.filteredTrades].reverse();
      let cumulative = 0;
      return trades.map((trade, index) => {
        cumulative += Number(trade.resultR || 0);
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
      const minVal = Math.min(...values, 0);
      const maxVal = Math.max(...values, 0);

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
      const minVal = Math.min(...values, 0);
      const maxVal = Math.max(...values, 0);

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
          localStorage.setItem("nasdaq_tasks_professional", JSON.stringify(newTasks));

          if (this.allCompleted && !this.celebrationPlayed) {
            this.triggerCelebration();
          }

          if (!this.allCompleted) {
            this.celebrationPlayed = false;
          }
        } catch (error) {
          console.error("Error al guardar tareas:", error);
        }
      },
      deep: true
    },
    trades: {
      handler(newTrades) {
        try {
          localStorage.setItem("nasdaq_trade_log_60r", JSON.stringify(newTrades));
        } catch (error) {
          console.error("Error al guardar trades:", error);
        }
      },
      deep: true
    }
  },
  mounted() {
    try {
      const savedTasks = localStorage.getItem("nasdaq_tasks_professional");
      if (savedTasks) {
        this.tasks = JSON.parse(savedTasks);
      }

      const savedTrades = localStorage.getItem("nasdaq_trade_log_60r");
      if (savedTrades) {
        this.trades = JSON.parse(savedTrades);
      }
    } catch (error) {
      console.error("Error al leer datos:", error);
    }

    this.updateClock();
    this.clockInterval = setInterval(this.updateClock, 1000);
    this.tradeForm.date = this.getTodayString();
  },
  beforeUnmount() {
    clearInterval(this.clockInterval);
  },
  methods: {
    getTodayString() {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },

    updateClock() {
      const now = new Date();
      this.currentTime = now.toLocaleTimeString();
      this.todayDate = now.toLocaleDateString();
    },

    addTask() {
      const text = this.newTask.trim();
      if (!text) return;

      this.tasks.push({
        id: Date.now() + Math.random(),
        text,
        done: false
      });

      this.newTask = "";
    },

    removeTask(id) {
      this.tasks = this.tasks.filter(task => task.id !== id);
    },

    clearCompleted() {
      this.tasks = this.tasks.filter(task => !task.done);
    },

    validateTradeForm() {
      return (
        this.tradeForm.date &&
        this.tradeForm.session &&
        this.tradeForm.direction &&
        this.tradeForm.setup &&
        this.tradeForm.resultR !== null &&
        this.tradeForm.resultR !== ""
      );
    },

    saveTrade() {
      if (!this.validateTradeForm()) {
        alert("Completa los campos principales del trade.");
        return;
      }

      const resultR = Number(this.tradeForm.resultR);
      const tradePayload = {
        date: this.tradeForm.date,
        session: this.tradeForm.session,
        direction: this.tradeForm.direction,
        setup: this.tradeForm.setup,
        resultR,
        resultUSD: resultR * this.rValue,
        note: this.tradeForm.note || ""
      };

      if (this.isEditing) {
        const index = this.trades.findIndex(trade => trade.id === this.editingTradeId);
        if (index !== -1) {
          this.trades[index] = {
            ...this.trades[index],
            ...tradePayload
          };
        }
      } else {
        if (this.dailyLimitReached || this.dailyLossLimitReached) return;

        this.trades.unshift({
          id: Date.now() + Math.random(),
          ...tradePayload
        });
      }

      this.resetTradeForm();
    },

    editTrade(trade) {
      this.editingTradeId = trade.id;
      this.tradeForm = {
        date: trade.date,
        session: trade.session,
        direction: trade.direction,
        setup: trade.setup,
        resultR: Number(trade.resultR),
        note: trade.note || ""
      };
      window.scrollTo({ top: 0, behavior: "smooth" });
    },

    resetTradeForm() {
      this.editingTradeId = null;
      this.tradeForm = {
        date: this.getTodayString(),
        session: "",
        direction: "",
        setup: "",
        resultR: null,
        note: ""
      };
    },

    removeTrade(id) {
      if (this.editingTradeId === id) {
        this.resetTradeForm();
      }
      this.trades = this.trades.filter(trade => trade.id !== id);
    },

    triggerCelebration() {
      this.celebrationPlayed = true;
      this.showCelebration = true;
      this.playHappySound();

      setTimeout(() => {
        this.showCelebration = false;
      }, 3000);
    },

    playHappySound() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!this.audioContext) {
          this.audioContext = new AudioCtx();
        }

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const notes = [
          { freq: 523.25, start: 0.0, duration: 0.16 },
          { freq: 659.25, start: 0.18, duration: 0.16 },
          { freq: 783.99, start: 0.36, duration: 0.16 },
          { freq: 1046.5, start: 0.56, duration: 0.30 }
        ];

        notes.forEach(note => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(note.freq, now + note.start);

          gain.gain.setValueAtTime(0.0001, now + note.start);
          gain.gain.exponentialRampToValueAtTime(0.18, now + note.start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

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

:root {
  color-scheme: dark;
}

.app-shell {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.12), transparent 28%),
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.09), transparent 24%),
    linear-gradient(135deg, #07111f 0%, #0b1526 50%, #111827 100%);
  color: #e5eefc;
  font-family: Inter, Arial, sans-serif;
  padding: 24px;
}

.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 38px 38px;
  mask-image: radial-gradient(circle at center, black 45%, transparent 100%);
  pointer-events: none;
}

.dashboard {
  position: relative;
  z-index: 1;
  max-width: 1380px;
  margin: 0 auto;
}

.hero-card,
.panel,
.mini-panel,
.curve-panel {
  background: rgba(11, 18, 32, 0.72);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.28);
}

.hero-card {
  border-radius: 24px;
  padding: 28px;
  margin-bottom: 24px;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 12px;
  color: #60a5fa;
  font-weight: 700;
}

.hero-card h1 {
  margin: 0;
  font-size: clamp(28px, 5vw, 44px);
  line-height: 1.05;
  color: #f8fbff;
}

.hero-text {
  margin: 12px 0 0;
  max-width: 720px;
  color: #9fb0c7;
  font-size: 15px;
  line-height: 1.7;
}

.market-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(96, 165, 250, 0.35);
  color: #dbeafe;
  font-weight: 700;
  white-space: nowrap;
}

.dot-live {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 16px #22c55e;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.stat-card {
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(7, 15, 26, 0.92));
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.stat-label {
  display: block;
  color: #8ba0bb;
  margin-bottom: 8px;
  font-size: 13px;
}

.stat-card strong {
  display: block;
  font-size: 28px;
  color: #ffffff;
}

.stat-card small {
  color: #8ba0bb;
}

.board-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 0.9fr);
  gap: 24px;
}

.panel {
  border-radius: 24px;
  padding: 24px;
}

.panel-header h2,
.mini-panel h3,
.curve-header h3 {
  margin: 0 0 8px;
  color: #f8fbff;
}

.panel-header p,
.mini-panel p,
.info-list,
.summary-row span,
.curve-header span {
  color: #95a8c2;
}

.trade-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
  flex-wrap: wrap;
}

.filter-box {
  min-width: 180px;
}

.filter-box label {
  display: block;
  margin-bottom: 8px;
  color: #a9bad0;
  font-size: 14px;
}

.filter-box select {
  width: 100%;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.9);
  color: #f8fbff;
}

.task-entry,
.trade-form-grid {
  display: grid;
  gap: 14px;
}

.task-entry {
  grid-template-columns: 1fr 150px;
  margin: 22px 0 24px;
}

.trade-form-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  color: #a9bad0;
  font-size: 14px;
}

.task-entry input,
.field input,
.field select {
  width: 100%;
  min-width: 0;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.9);
  color: #f8fbff;
  font-size: 15px;
  outline: none;
}

.task-entry input:focus,
.field input:focus,
.field select:focus {
  border-color: rgba(59, 130, 246, 0.8);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.primary-btn,
.secondary-btn,
.danger-btn,
.drag-handle,
.edit-btn {
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
}

.primary-btn {
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: white;
  box-shadow: 0 10px 30px rgba(37, 99, 235, 0.25);
  min-height: 52px;
  padding: 12px 18px;
}

.secondary-btn {
  padding: 14px 18px;
  background: rgba(51, 65, 85, 0.9);
  color: white;
}

.danger-btn {
  padding: 12px 14px;
  background: rgba(127, 29, 29, 0.95);
  color: #fee2e2;
}

.edit-btn {
  padding: 8px 12px;
  background: rgba(30, 64, 175, 0.95);
  color: #dbeafe;
  border-radius: 12px;
}

.small-btn {
  min-height: auto;
  padding: 8px 12px;
  border-radius: 12px;
}

.drag-handle {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  background: rgba(30, 41, 59, 0.95);
  color: #cbd5e1;
  font-size: 18px;
}

.empty-state {
  border-radius: 20px;
  padding: 36px 20px;
  text-align: center;
  background: rgba(15, 23, 42, 0.7);
  border: 1px dashed rgba(148, 163, 184, 0.2);
}

.compact-empty {
  padding: 22px 16px;
}

.empty-icon {
  font-size: 42px;
  margin-bottom: 10px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.task-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(9, 16, 29, 0.9));
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.task-card.completed {
  border-color: rgba(34, 197, 94, 0.35);
  background: linear-gradient(180deg, rgba(7, 27, 20, 0.92), rgba(7, 22, 18, 0.92));
}

.task-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.task-left input[type="checkbox"] {
  width: 20px;
  height: 20px;
  accent-color: #22c55e;
  flex-shrink: 0;
}

.task-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.task-text {
  color: #f8fbff;
  font-size: 15px;
  line-height: 1.45;
  word-break: break-word;
}

.task-card.completed .task-text {
  text-decoration: line-through;
  color: #8bb79a;
}

.task-content small {
  margin-top: 4px;
  color: #7f93ad;
}

.task-footer,
.trade-actions {
  margin-top: 24px;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}

.progress-wrap {
  flex: 1;
}

.progress-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #a5b4c9;
  font-size: 14px;
}

.progress-bar {
  height: 12px;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.95);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e, #38bdf8);
  transition: width 0.35s ease;
}

.money-fill {
  background: linear-gradient(90deg, #f59e0b, #22c55e);
}

.panel-side {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mini-panel,
.curve-panel {
  border-radius: 20px;
  padding: 20px;
}

.summary-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.summary-row strong {
  color: #f8fbff;
}

.trades-panel {
  margin-top: 24px;
}

.trades-table-wrap {
  overflow-x: auto;
}

.trades-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1000px;
}

.trades-table th,
.trades-table td {
  padding: 12px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.trades-table th {
  color: #9db0c9;
  font-weight: 700;
}

.action-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.positiveText {
  color: #4ade80;
  font-weight: 700;
}

.negativeText {
  color: #f87171;
  font-weight: 700;
}

.okText {
  color: #4ade80;
}

.dangerText {
  color: #f87171;
}

.warning-banner,
.danger-banner {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 14px;
  font-weight: 700;
}

.warning-banner {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.danger-banner {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.curve-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.chart-wrap {
  width: 100%;
  height: 260px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
}

.curve-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.zero-line {
  stroke: rgba(255,255,255,0.18);
  stroke-width: 2;
  stroke-dasharray: 8 8;
}

.curve-line {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 4;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.curve-point {
  fill: #22c55e;
  stroke: #07111f;
  stroke-width: 2;
}

.top-space {
  margin-top: 18px;
}

.ghost-task {
  opacity: 0.5;
  background: rgba(37, 99, 235, 0.2);
  border: 1px dashed #60a5fa;
}

.chosen-task {
  transform: scale(1.01);
}

.drag-task {
  transform: rotate(1deg);
}

.celebration-overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 11, 20, 0.74);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 9999;
}

.celebration-box {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 34px 28px;
  border-radius: 24px;
  min-width: min(90vw, 380px);
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.celebration-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.confetti {
  position: absolute;
  width: 14px;
  height: 14px;
  top: -30px;
  border-radius: 4px;
  animation: fall 3s linear forwards;
}

.confetti-1 { left: 8%; background: #38bdf8; }
.confetti-2 { left: 18%; background: #f97316; }
.confetti-3 { left: 28%; background: #22c55e; }
.confetti-4 { left: 38%; background: #eab308; }
.confetti-5 { left: 48%; background: #a855f7; }
.confetti-6 { left: 58%; background: #ef4444; }
.confetti-7 { left: 68%; background: #06b6d4; }
.confetti-8 { left: 78%; background: #84cc16; }

@keyframes fall {
  0% {
    transform: translateY(-20px) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(115vh) rotate(760deg);
    opacity: 0.92;
  }
}

@media (max-width: 1100px) {
  .board-grid {
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
  .app-shell {
    padding: 14px;
  }

  .hero-top,
  .trade-header {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-stats,
  .trade-form-grid {
    grid-template-columns: 1fr;
  }

  .task-entry {
    grid-template-columns: 1fr;
  }

  .task-card,
  .task-footer,
  .trade-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .action-cell {
    flex-direction: column;
    align-items: stretch;
  }

  .danger-btn,
  .primary-btn,
  .secondary-btn,
  .edit-btn {
    width: 100%;
    min-height: 48px;
  }
}
</style>