<template>
  <div class="app">
    <div class="container">
      <h1>Mi Todo List</h1>
      <p class="subtitle">Agrega tus tareas y se guardarán automáticamente.</p>

      <div class="input-row">
        <input
          v-model="newTask"
          @keyup.enter="addTask"
          type="text"
          placeholder="Escribe una tarea..."
        />
        <button @click="addTask">Agregar</button>
      </div>

      <div v-if="tasks.length === 0" class="empty-state">
        No tienes tareas todavía.
      </div>

      <ul v-else class="task-list">
        <li v-for="task in tasks" :key="task.id" class="task-item">
          <label class="task-left">
            <input type="checkbox" v-model="task.done" />
            <span :class="{ done: task.done }">{{ task.text }}</span>
          </label>

          <button class="delete-btn" @click="removeTask(task.id)">Eliminar</button>
        </li>
      </ul>

      <div class="footer" v-if="tasks.length > 0">
        <span>{{ completedCount }} / {{ tasks.length }} completadas</span>
        <button class="clear-btn" @click="clearCompleted">Eliminar completadas</button>
      </div>
    </div>

    <transition name="celebration">
      <div v-if="showCelebration" class="celebration-overlay">
        <div class="celebration-box">
          <div class="emoji">🎉✨🥳</div>
          <h2>¡Felicidades!</h2>
          <p>Completaste todas tus tareas</p>
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
export default {
  name: "App",
  data() {
    return {
      newTask: "",
      tasks: [],
      showCelebration: false,
      celebrationPlayed: false,
      audioContext: null
    };
  },
  computed: {
    completedCount() {
      return this.tasks.filter(task => task.done).length;
    },
    allCompleted() {
      return this.tasks.length > 0 && this.tasks.every(task => task.done);
    }
  },
  watch: {
    tasks: {
      handler(newTasks) {
        localStorage.setItem("my_tasks_vue_app", JSON.stringify(newTasks));

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
    const savedTasks = localStorage.getItem("my_tasks_vue_app");
    if (savedTasks) {
      this.tasks = JSON.parse(savedTasks);
    }
  },
  methods: {
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
          { freq: 523.25, start: 0.0, duration: 0.18 }, // C5
          { freq: 659.25, start: 0.20, duration: 0.18 }, // E5
          { freq: 783.99, start: 0.40, duration: 0.18 }, // G5
          { freq: 1046.5, start: 0.62, duration: 0.35 } // C6
        ];

        notes.forEach(note => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
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

.app {
  min-height: 100vh;
  padding: 24px;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  font-family: Arial, sans-serif;
  color: #f8fafc;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

h1 {
  margin: 0 0 8px;
  font-size: 32px;
}

.subtitle {
  margin: 0 0 22px;
  color: #cbd5e1;
}

.input-row {
  display: flex;
  gap: 12px;
  margin-bottom: 22px;
}

.input-row input {
  flex: 1;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid #334155;
  background: #111827;
  color: white;
  font-size: 16px;
  outline: none;
}

.input-row input:focus {
  border-color: #60a5fa;
}

.input-row button,
.delete-btn,
.clear-btn {
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: bold;
}

.input-row button {
  background: #2563eb;
  color: white;
}

.input-row button:hover {
  opacity: 0.92;
}

.empty-state {
  padding: 22px;
  text-align: center;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14px;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: #111827;
  border: 1px solid #1f2937;
}

.task-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.task-left input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.task-left span {
  font-size: 16px;
  word-break: break-word;
}

.task-left span.done {
  text-decoration: line-through;
  opacity: 0.6;
}

.delete-btn {
  background: #dc2626;
  color: white;
}

.clear-btn {
  background: #475569;
  color: white;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  color: #cbd5e1;
}

.celebration-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
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
  background: white;
  color: #0f172a;
  padding: 32px 28px;
  border-radius: 22px;
  min-width: 280px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: popIn 0.4s ease;
}

.emoji {
  font-size: 44px;
  margin-bottom: 8px;
}

.celebration-box h2 {
  margin: 0 0 8px;
  font-size: 30px;
}

.celebration-box p {
  margin: 0;
  font-size: 18px;
}

.confetti {
  position: absolute;
  width: 14px;
  height: 14px;
  top: -20px;
  border-radius: 4px;
  animation: fall 3s linear forwards;
}

.confetti-1 { left: 10%; background: #f59e0b; animation-delay: 0s; }
.confetti-2 { left: 20%; background: #22c55e; animation-delay: 0.2s; }
.confetti-3 { left: 30%; background: #3b82f6; animation-delay: 0.1s; }
.confetti-4 { left: 45%; background: #ef4444; animation-delay: 0.35s; }
.confetti-5 { left: 55%; background: #a855f7; animation-delay: 0.15s; }
.confetti-6 { left: 68%; background: #06b6d4; animation-delay: 0.3s; }
.confetti-7 { left: 80%; background: #84cc16; animation-delay: 0.05s; }
.confetti-8 { left: 90%; background: #f97316; animation-delay: 0.25s; }

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
    transform: scale(0.7);
    opacity: 0;
  }
  70% {
    transform: scale(1.06);
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
    transform: translateY(110vh) rotate(720deg);
    opacity: 0.8;
  }
}

@media (max-width: 640px) {
  .input-row {
    flex-direction: column;
  }

  .task-item,
  .footer {
    flex-direction: column;
    align-items: stretch;
  }

  .delete-btn,
  .clear-btn,
  .input-row button {
    width: 100%;
  }
}
</style>