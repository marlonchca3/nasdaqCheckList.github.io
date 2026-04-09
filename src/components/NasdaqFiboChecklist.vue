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
          <div class="sync-status" :class="`sync-status-${syncState}`">
            <span class="sync-status-dot"></span>
            <div class="sync-status-copy">
              <strong>{{ syncStatusLabel }}</strong>
              <span v-if="syncStatusDetail">{{ syncStatusDetail }}</span>
            </div>
          </div>
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
              <span class="pill">Maximo {{ maxDailyTasks }}</span>
            </div>
          </div>

         <div class="task-form">
  <input
    v-model="newTask"
    type="text"
    placeholder="Ejemplo: Esperar confirmación en zona"
    :disabled="taskLimitReached"
    @keyup.enter="addTask"
  />

  <button type="button" class="primary-btn" :disabled="taskLimitReached" @click="addTask">
    Agregar
  </button>
</div>

          <p class="task-limit-note" :class="{ 'task-limit-note-warning': taskLimitReached }">
            {{ taskLimitReached
              ? `Llegaste al máximo de ${maxDailyTasks} tareas para hoy.`
              : `Puedes crear hasta ${maxDailyTasks} tareas para el día.` }}
          </p>

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
            <button
              class="secondary-btn"
              :class="{ 'secondary-btn-muted': taskVoiceMuted }"
              @click="toggleTaskVoiceMuted"
            >
              {{ taskVoiceMuted ? '🔇 Tareas en mudo' : '🔊 Voz de tareas activa' }}
            </button>
            <button class="secondary-btn" @click="clearCompleted">
              Borrar completadas
            </button>
            <button
              class="secondary-btn"
              :disabled="taskVoiceMuted"
              @click="announceCompletedTasks"
              title="Prueba voz"
            >
              🔊 Probar voz
            </button>
          </div>
        </section>

        <div class="panel-stack">
          <section class="panel pomodoro-panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Concentración</p>
                <h2>Pomodoro editable</h2>
              </div>

              <div class="header-pills">
                <span class="pill">25/5</span>
                <span class="pill">Descanso largo 15m</span>
              </div>
            </div>

            <p class="pomodoro-copy">
              Ajusta tu meta diaria de enfoque y trabaja en bloques pomodoro con descansos automáticos.
            </p>

            <div class="pomodoro-settings-grid">
              <div class="metric-box pomodoro-setting-box">
                <span>Meta diaria (horas)</span>
                <input v-model.number="pomodoroTargetHours" type="number" min="0.5" step="0.5" />
              </div>

              <article class="mini-stat pomodoro-setting-stat">
                <span>Meta actual</span>
                <strong>{{ pomodoroTargetHoursLabel }}</strong>
              </article>
            </div>

            <div class="pomodoro-hero" :class="`pomodoro-mode-${pomodoro.currentMode}`">
              <span class="pomodoro-mode-chip">{{ pomodoroModeLabel }}</span>
              <strong class="pomodoro-time">{{ pomodoroFormattedTime }}</strong>
              <span class="pomodoro-status">{{ pomodoroStatusLabel }}</span>
            </div>

            <div class="progress-wrap pomodoro-progress-wrap">
              <div class="progress-labels">
                <span>Avance {{ pomodoroTargetHoursLabel }}</span>
                <strong>{{ pomodoroProgressPercent }}%</strong>
              </div>

              <div class="progress-bar">
                <div
                  class="progress-fill progress-fill-pomodoro"
                  :style="{ width: pomodoroProgressPercent + '%' }"
                ></div>
              </div>
            </div>

            <div class="stats-mini-grid pomodoro-stats-grid">
              <article class="mini-stat">
                <span>Enfoque acumulado</span>
                <strong>{{ pomodoroFocusedLabel }}</strong>
              </article>

              <article class="mini-stat">
                <span>Tiempo restante</span>
                <strong>{{ pomodoroRemainingLabel }}</strong>
              </article>

              <article class="mini-stat">
                <span>Bloques cerrados</span>
                <strong>{{ pomodoro.completedFocusSessions }}</strong>
              </article>
            </div>

            <div class="pomodoro-controls">
              <button class="primary-btn" @click="togglePomodoro">
                {{ pomodoro.isRunning ? 'Pausar' : (pomodoroGoalReached ? 'Seguir' : 'Iniciar') }}
              </button>
              <button class="secondary-btn" @click="skipPomodoroPhase">
                Saltar fase
              </button>
              <button class="secondary-btn" @click="resetPomodoro">
                Reiniciar
              </button>
            </div>
          </section>

          <section class="panel news-panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Alertas</p>
                <h2>Noticias Nasdaq</h2>
              </div>

              <div class="header-pills">
                <span class="pill">{{ newsAlertsStatusLabel }}</span>
                <span v-if="nextNewsReminder" class="pill">
                  Próxima {{ formatReminderDateTime(nextNewsReminder) }}
                </span>
              </div>
            </div>

            <p class="news-panel-copy">
              Crea alertas manuales para CPI, Powell, NFP o cualquier evento que quieras vigilar y la app te avisa 15 minutos antes.
            </p>

            <p class="news-api-feedback">
              {{ newsAlertsHelpText }}
            </p>

            <div class="news-toolbar">
              <button class="secondary-btn" @click="toggleNewsAlerts">
                {{ newsAlertsEnabled ? 'Pausar alertas' : 'Activar alertas' }}
              </button>
              <button
                v-if="hasBrowserNotificationSupport && notificationPermission !== 'granted'"
                class="secondary-btn"
                @click="requestNewsNotificationPermission"
              >
                {{ notificationPermission === 'denied' ? 'Revisar permisos' : 'Permitir notificaciones' }}
              </button>
            </div>

            <div class="news-form-grid">
              <input
                v-model="newsReminderForm.title"
                type="text"
                placeholder="Agregar alerta manual: CPI, Powell, NVIDIA earnings"
                @keyup.enter="addNewsReminder"
              />
              <input v-model="newsReminderForm.date" type="date" />
              <input v-model="newsReminderForm.time" type="time" />
              <button class="primary-btn" @click="addNewsReminder">
                Agregar alerta
              </button>
            </div>

            <div v-if="sortedNewsReminders.length" class="news-reminder-list">
              <article
                v-for="reminder in sortedNewsReminders"
                :key="reminder.id"
                class="news-reminder-card"
              >
                <div class="news-reminder-copy">
                  <strong>{{ reminder.title }}</strong>
                  <small class="news-reminder-source">{{ reminder.sourceLabel }}</small>
                  <span>{{ formatReminderDateTime(reminder) }}</span>
                  <span v-if="reminder.meta" class="news-reminder-meta">{{ reminder.meta }}</span>
                </div>

                <div class="news-reminder-actions">
                  <span class="news-reminder-badge">{{ getReminderStatus(reminder) }}</span>
                  <button
                    class="tiny-btn danger"
                    @click="removeNewsReminder(reminder.id)"
                  >
                    Borrar
                  </button>
                </div>
              </article>
            </div>

            <p v-else class="news-reminder-empty">
              No hay alertas cargadas todavía. Agrega tu próximo evento manual y la app te avisará 15 minutos antes.
            </p>
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
                <span>Avanzado</span>
                <strong :class="{ positive: advancedGoalUSD > 0, negative: advancedGoalUSD < 0 }">
                  ${{ Number(advancedGoalUSD || 0).toFixed(2) }}
                </strong>
              </article>

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
                <strong>{{ Number(targetProgressPercent || 0).toFixed(0) }}% · Ganado ${{ Number(advancedGoalUSD || 0).toFixed(2) }}</strong>
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
        </div>
      </section>

      <section class="panel trade-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Registro</p>
            <h2>Trades</h2>
          </div>

          <div class="trade-panel-tools">
            <div v-if="tradeCooldownActive" class="trade-cooldown-chip" :class="tradeCooldownChipClass">
              <strong>{{ tradeCooldown.reason === 'partial' ? 'Bloqueo 10m' : 'Bloqueo 20m' }}</strong>
              <span>{{ tradeCooldownLabel }} restantes</span>
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
        </div>

        <section
          class="emotion-check-card"
          :class="{
            'emotion-check-card-ready': emotionChecklist.state === 'calm',
            'emotion-check-card-blocked': emotionChecklist.state === 'anxious'
          }"
        >
          <div class="emotion-check-copy">
            <span class="emotion-check-label">Checklist emocional</span>
            <strong>{{ emotionChecklistTitle }}</strong>
            <p>{{ emotionChecklistMessage }}</p>
          </div>

          <div class="emotion-toggle-group">
            <button
              class="emotion-toggle-btn"
              :class="{ active: emotionChecklist.state === 'calm' }"
              @click="setEmotionState('calm')"
            >
              Estas calmado
            </button>

            <button
              class="emotion-toggle-btn emotion-toggle-btn-danger"
              :class="{ active: emotionChecklist.state === 'anxious' }"
              @click="setEmotionState('anxious')"
            >
              Estas ansioso
            </button>
          </div>
        </section>

        <section class="rule-check-card" :class="ruleChecklistCardClass">
          <div class="rule-check-copy">
            <span class="rule-check-label">Cumplimiento de reglas</span>
            <strong>{{ ruleChecklistTitle }}</strong>
            <p>{{ ruleChecklistMessage }}</p>
          </div>

          <div class="rule-status-grid">
            <button
              class="rule-status-card rule-status-card-followed"
              :class="{ active: tradeForm.ruleStatus === 'followed' }"
              :disabled="isTradeRegistrationBlocked"
              @click="setTradeRuleStatus('followed')"
            >
              <strong>Seguí</strong>
              <span>Tarjeta verde</span>
            </button>

            <button
              class="rule-status-card rule-status-card-partial"
              :class="{ active: tradeForm.ruleStatus === 'partial' }"
              :disabled="isTradeRegistrationBlocked"
              @click="setTradeRuleStatus('partial')"
            >
              <strong>Parcial</strong>
              <span>Tarjeta amarilla</span>
            </button>

            <button
              class="rule-status-card rule-status-card-missed"
              :class="{ active: tradeForm.ruleStatus === 'missed' }"
              :disabled="isTradeRegistrationBlocked"
              @click="setTradeRuleStatus('missed')"
            >
              <strong>No seguí</strong>
              <span>Tarjeta roja</span>
            </button>
          </div>

          <div class="progress-wrap rule-progress-wrap">
            <div class="progress-labels">
              <span>Disciplina semanal</span>
              <strong>{{ currentWeekRuleStats.percent }}% · {{ currentWeekRuleStats.label }}</strong>
            </div>

            <div class="progress-bar progress-bar-rule">
              <div
                class="progress-fill progress-fill-rule"
                :style="{ width: currentWeekRuleStats.percent + '%' }"
              ></div>
            </div>
          </div>
        </section>

        <p v-if="tradeBlockingReason" class="trade-blocking-alert" :class="{ bad: isTradeRegistrationBlocked }">
          {{ tradeBlockingReason }}
        </p>

        <div class="trade-form-grid">
          <input v-model="tradeForm.date" type="date" :disabled="isTradeRegistrationBlocked" />

          <select v-model="tradeForm.session" :disabled="isTradeRegistrationBlocked">
            <option disabled value="">Sesión</option>
            <option>London</option>
            <option>New York</option>
            <option>Asia</option>
          </select>

          <select v-model="tradeForm.direction" :disabled="isTradeRegistrationBlocked">
            <option disabled value="">Dirección</option>
            <option>Long</option>
            <option>Short</option>
          </select>

          <input
            v-model.number="tradeForm.resultR"
            type="number"
            step="any"
            placeholder="Resultado R"
            :disabled="isTradeRegistrationBlocked"
          />

          <input v-model="tradeForm.note" type="text" placeholder="Nota" :disabled="isTradeRegistrationBlocked" />
        </div>

        <div class="trade-form-actions">
          <button class="primary-btn" :disabled="isTradeRegistrationBlocked" @click="saveTrade">
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
                <th>Reglas</th>
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
                <td>
                  <span class="rule-badge" :class="getRuleStatusBadgeClass(trade.ruleStatus)">
                    {{ getRuleStatusLabel(trade.ruleStatus) }}
                  </span>
                </td>
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

      <section class="panel calendar-panel">
        <div class="panel-header calendar-panel-header">
          <div>
            <p class="eyebrow">Performance</p>
            <h2>Calendario mensual</h2>
          </div>

          <div class="calendar-nav">
            <button class="secondary-btn calendar-nav-btn" @click="changeCalendarMonth(-1)">
              ←
            </button>
            <div class="calendar-month-chip">{{ calendarMonthLabel }}</div>
            <button class="secondary-btn calendar-nav-btn" @click="changeCalendarMonth(1)">
              →
            </button>
            <button class="secondary-btn" @click="resetCalendarMonth">
              Hoy
            </button>
          </div>
        </div>

        <div class="calendar-stats">
          <article class="calendar-stat-card">
            <span>R del mes</span>
            <strong :class="{ positive: calendarMonthStats.totalR > 0, negative: calendarMonthStats.totalR < 0 }">
              {{ formatCalendarValue(calendarMonthStats.totalR, 'R') }}
            </strong>
          </article>

          <article class="calendar-stat-card">
            <span>USD del mes</span>
            <strong :class="{ positive: calendarMonthStats.totalUSD > 0, negative: calendarMonthStats.totalUSD < 0 }">
              ${{ formatCalendarValue(calendarMonthStats.totalUSD) }}
            </strong>
          </article>

          <article class="calendar-stat-card">
            <span>Trades</span>
            <strong>{{ calendarMonthStats.totalTrades }}</strong>
          </article>

          <article class="calendar-stat-card">
            <span>Días activos</span>
            <strong>{{ calendarMonthStats.activeDays }}</strong>
          </article>

          <article class="calendar-stat-card">
            <span>Días verdes</span>
            <strong>{{ calendarMonthStats.positiveDays }}</strong>
          </article>

          <article class="calendar-stat-card">
            <span>Win rate</span>
            <strong>{{ calendarMonthStats.winRate }}%</strong>
          </article>
        </div>

        <div class="calendar-shell">
          <div class="calendar-weekdays">
            <span v-for="dayName in calendarDayNames" :key="dayName" class="calendar-weekday">
              {{ dayName }}
            </span>
            <span class="calendar-weekday calendar-weekday-summary">Semana</span>
          </div>

          <div v-for="week in calendarWeeks" :key="week.key" class="calendar-row">
            <article
              v-for="day in week.days"
              :key="day.key"
              class="calendar-day-card"
              :class="{
                'calendar-day-empty': !day.isCurrentMonth,
                'calendar-day-positive': day.summary && day.summary.totalR > 0,
                'calendar-day-negative': day.summary && day.summary.totalR < 0,
                'calendar-day-neutral': day.summary && day.summary.totalR === 0,
                'calendar-day-today': day.isToday
              }"
            >
              <div v-if="day.isCurrentMonth" class="calendar-day-inner">
                <div class="calendar-day-top">
                  <span class="calendar-day-number">{{ day.dayNumber }}</span>
                  <span v-if="day.summary" class="calendar-day-trades">
                    {{ day.summary.tradeCount }} trade{{ day.summary.tradeCount === 1 ? '' : 's' }}
                  </span>
                </div>

                <template v-if="day.summary">
                  <strong class="calendar-day-result">
                    {{ formatCalendarValue(day.summary.totalR, 'R') }}
                  </strong>
                  <span class="calendar-day-subline">
                    ${{ formatCalendarValue(day.summary.totalUSD) }}
                  </span>
                  <span class="calendar-day-subline muted">
                    {{ getCalendarWinRate(day.summary) }}% acierto
                  </span>
                </template>
              </div>
            </article>

            <aside
              class="calendar-week-summary"
              :class="{
                'calendar-week-positive': week.summary.totalR > 0,
                'calendar-week-negative': week.summary.totalR < 0
              }"
            >
              <span>{{ week.label }}</span>
              <strong>{{ formatCalendarValue(week.summary.totalR, 'R') }}</strong>
              <small>${{ formatCalendarValue(week.summary.totalUSD) }}</small>
              <small>{{ week.summary.activeDays }} días</small>
            </aside>
          </div>
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