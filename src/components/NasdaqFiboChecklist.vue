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
          <p v-if="authInfoMessage && !authErrorMessage" class="auth-feedback auth-feedback-info">
            {{ authInfoMessage }}
          </p>
          <p v-if="authErrorMessage" class="auth-feedback auth-feedback-error">
            {{ authErrorMessage }}
          </p>
        </div>

        <div class="auth-right">
          <button class="theme-toggle-btn" @click="toggleTheme">
            {{ isDarkMode ? '☀️ Claro' : '🌙 Oscuro' }}
          </button>

          <button
            v-if="!user"
            class="primary-btn"
            :disabled="isSigningIn"
            @click="signInWithGoogle"
          >
            {{ isSigningIn ? 'Conectando...' : 'Ingresar con Google' }}
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
                    <input
                      :checked="element.done"
                      type="checkbox"
                      @change="toggleTaskDone(element)"
                    />
                    <span></span>
                  </label>

                  <div class="task-copy">
                    <p>{{ element.text }}</p>
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
            <button class="secondary-btn" @click="announceCompletedTasks" title="Prueba voz">
              🔊 Probar voz
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

<script src="../js/NasdaqFiboChecklistLogic.js"></script>
<style scoped src="../styles/NasdaqFiboChecklist.css"></style>