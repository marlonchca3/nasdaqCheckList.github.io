<template>
  <div class="app-shell">
    <div class="bg-grid"></div>

    <main class="dashboard">
      <section class="hero-card">
        <div class="hero-top">
          <div>
            <p class="eyebrow">Trading Workflow</p>
            <h1>Nasdaq 5M Task Board</h1>
            <p class="hero-text">
              Organiza tus tareas de trading, análisis y ejecución con una interfaz profesional.
            </p>
          </div>

          <div class="market-badge">
            <span class="dot-live"></span>
            <span>NASDAQ · 5 MIN</span>
          </div>
        </div>

        <div class="hero-stats">
          <div class="stat-card">
            <span class="stat-label">Total tasks</span>
            <strong>{{ tasks.length }}</strong>
          </div>

          <div class="stat-card">
            <span class="stat-label">Completadas</span>
            <strong>{{ completedCount }}</strong>
          </div>

          <div class="stat-card">
            <span class="stat-label">Pendientes</span>
            <strong>{{ pendingCount }}</strong>
          </div>

          <div class="stat-card">
            <span class="stat-label">Hora local</span>
            <strong>{{ currentTime }}</strong>
          </div>
        </div>
      </section>

      <section class="board-grid">
        <div class="panel panel-main">
          <div class="panel-header">
            <div>
              <h2>Task Manager</h2>
              <p>Agrega, completa o elimina tareas. Todo se guarda automáticamente.</p>
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

          <div v-else class="task-list">
            <article
              v-for="task in tasks"
              :key="task.id"
              class="task-card"
              :class="{ completed: task.done }"
            >
              <label class="task-left">
                <input type="checkbox" v-model="task.done" />
                <div class="task-content">
                  <span class="task-text">{{ task.text }}</span>
                  <small>{{ task.done ? 'Completada' : 'En espera' }}</small>
                </div>
              </label>

              <button class="danger-btn" @click="removeTask(task.id)">
                Eliminar
              </button>
            </article>
          </div>

          <div v-if="tasks.length > 0" class="task-footer">
            <div class="progress-wrap">
              <div class="progress-head">
                <span>Progreso</span>
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
            <h3>Estado actual</h3>
            <p class="status-text" :class="allCompleted ? 'success' : 'warning'">
              {{ allCompleted && tasks.length > 0
                ? 'Todas las tareas fueron completadas'
                : 'Aún hay tareas pendientes' }}
            </p>
          </div>

          <div class="mini-panel">
            <h3>Enfoque Nasdaq 5M</h3>
            <ul class="info-list">
              <li>Prioriza claridad antes de velocidad.</li>
              <li>Evita sobreoperar cuando no hay setup.</li>
              <li>Marca solo tareas realmente ejecutables.</li>
              <li>Mantén el tablero limpio antes de cada sesión.</li>
            </ul>
          </div>

          <div class="mini-panel">
            <h3>Resumen rápido</h3>
            <div class="summary-box">
              <div class="summary-row">
                <span>Win mindset</span>
                <strong>Disciplinado</strong>
              </div>
              <div class="summary-row">
                <span>Sesión</span>
                <strong>Scalping / 5M</strong>
              </div>
              <div class="summary-row">
                <span>Persistencia</span>
                <strong>LocalStorage</strong>
              </div>
            </div>
          </div>
        </aside>
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
        <div class="confetti confetti-9"></div>
        <div class="confetti confetti-10"></div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: "App",
  data() {
    return {
      newTask: "",
      tasks: [],
      showCelebration: false,
      celebrationPlayed: false,
      audioContext: null,
      currentTime: ""
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
    }
  },
  watch: {
    tasks: {
      handler(newTasks) {
        localStorage.setItem("nasdaq_tasks_professional", JSON.stringify(newTasks));

        if (this.allCompleted && !this.celebrationPlayed) {
          this.triggerCelebration();
        }

        if (!this.allCompleted) {
          this.celebrationPlayed = false;
        }
      },
      deep: true
    }
  },
  mounted() {
    const savedTasks = localStorage.getItem("nasdaq_tasks_professional");
    if (savedTasks) {
      this.tasks = JSON.parse(savedTasks);
    }

    this.updateClock();
    this.clockInterval = setInterval(this.updateClock, 1000);
  },
  beforeUnmount() {
    clearInterval(this.clockInterval);
  },
  methods: {
    updateClock() {
      const now = new Date();
      this.currentTime = now.toLocaleTimeString();
    },
    addTask() {
      const text = this.newTask.trim();
      if (!text) return;

      this.tasks.unshift({
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
          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + note.start + note.duration
          );

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

body {
  margin: 0;
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
.mini-panel {
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
  font-size: 28px;
  color: #ffffff;
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
.mini-panel h3 {
  margin: 0 0 8px;
  color: #f8fbff;
}

.panel-header p,
.mini-panel p,
.info-list,
.summary-row span {
  color: #95a8c2;
}

.task-entry {
  display: grid;
  grid-template-columns: 1fr 150px;
  gap: 14px;
  margin: 22px 0 24px;
}

.task-entry input {
  width: 100%;
  min-width: 0;
  padding: 16px 18px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.9);
  color: #f8fbff;
  font-size: 15px;
  outline: none;
  transition: 0.2s ease;
}

.task-entry input:focus {
  border-color: rgba(59, 130, 246, 0.8);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.primary-btn,
.secondary-btn,
.danger-btn {
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
  transition: transform 0.15s ease, opacity 0.2s ease, box-shadow 0.2s ease;
}

.primary-btn:hover,
.secondary-btn:hover,
.danger-btn:hover {
  transform: translateY(-1px);
  opacity: 0.96;
}

.primary-btn {
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  color: white;
  box-shadow: 0 10px 30px rgba(37, 99, 235, 0.25);
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

.empty-state {
  border-radius: 20px;
  padding: 36px 20px;
  text-align: center;
  background: rgba(15, 23, 42, 0.7);
  border: 1px dashed rgba(148, 163, 184, 0.2);
}

.empty-icon {
  font-size: 42px;
  margin-bottom: 10px;
}

.empty-state h3 {
  margin: 0 0 8px;
}

.empty-state p {
  margin: 0;
  color: #8ea1bc;
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

.task-footer {
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

.panel-side {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.mini-panel {
  border-radius: 20px;
  padding: 20px;
}

.status-text {
  margin: 0;
  font-weight: 700;
}

.status-text.success {
  color: #4ade80;
}

.status-text.warning {
  color: #fbbf24;
}

.info-list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
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
  animation: popIn 0.4s ease;
}

.celebration-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.celebration-box h2 {
  margin: 0 0 8px;
  font-size: 30px;
}

.celebration-box p {
  margin: 0;
  font-size: 17px;
}

.confetti {
  position: absolute;
  width: 14px;
  height: 14px;
  top: -30px;
  border-radius: 4px;
  animation: fall 3s linear forwards;
}

.confetti-1 { left: 8%; background: #38bdf8; animation-delay: 0s; }
.confetti-2 { left: 18%; background: #f97316; animation-delay: 0.15s; }
.confetti-3 { left: 28%; background: #22c55e; animation-delay: 0.05s; }
.confetti-4 { left: 38%; background: #eab308; animation-delay: 0.2s; }
.confetti-5 { left: 48%; background: #a855f7; animation-delay: 0.1s; }
.confetti-6 { left: 58%; background: #ef4444; animation-delay: 0.18s; }
.confetti-7 { left: 68%; background: #06b6d4; animation-delay: 0.08s; }
.confetti-8 { left: 78%; background: #84cc16; animation-delay: 0.24s; }
.confetti-9 { left: 88%; background: #3b82f6; animation-delay: 0.12s; }
.confetti-10 { left: 94%; background: #f59e0b; animation-delay: 0.28s; }

.celebration-enter-active,
.celebration-leave-active {
  transition: opacity 0.25s ease;
}

.celebration-enter-from,
.celebration-leave-to {
  opacity: 0;
}

@keyframes popIn {
  0% {
    transform: scale(0.72);
    opacity: 0;
  }
  70% {
    transform: scale(1.04);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}

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
}

@media (max-width: 720px) {
  .app-shell {
    padding: 14px;
  }

  .hero-card,
  .panel,
  .mini-panel {
    border-radius: 18px;
  }

  .hero-top {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }

  .task-entry {
    grid-template-columns: 1fr;
  }

  .task-card {
    flex-direction: column;
    align-items: stretch;
  }

  .task-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .danger-btn,
  .primary-btn,
  .secondary-btn {
    width: 100%;
    min-height: 48px;
  }

  .market-badge {
    width: fit-content;
  }
}

@media (max-width: 420px) {
  .hero-card h1 {
    font-size: 28px;
  }

  .task-text {
    font-size: 14px;
  }

  .celebration-box h2 {
    font-size: 25px;
  }
}
</style>