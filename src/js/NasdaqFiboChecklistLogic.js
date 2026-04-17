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
      newsAlertsEnabled: true,
      notificationPermission: "default",
      lastNewsAlertCheckKey: "",
      hoveredCurveIndex: null,
      speechSequenceToken: 0,
      speechRepeatTimer: null,

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
      tradeCooldown: {
        until: "",
        reason: ""
      },
      lastAnnouncedTradeCooldownUntil: "",
      newsReminderForm: {
        title: "",
        date: new Date().toISOString().slice(0, 10),
        time: ""
      },
      newsReminders: [],
      pendingRuleSelections: [],

      tradeForm: {
        date: new Date().toISOString().slice(0, 10),
        session: "",
        direction: "",
        ruleStatus: "",
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

    maxDailyTasks() {
      return 10;
    },

    taskLimitReached() {
      return this.tasks.length >= this.maxDailyTasks;
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

    tradeCooldownRemainingSeconds() {
      this.currentTime;

      if (!this.tradeCooldown.until) return 0;

      const cooldownUntil = new Date(this.tradeCooldown.until);
      if (Number.isNaN(cooldownUntil.getTime())) return 0;

      return Math.max(Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000), 0);
    },

    tradeCooldownActive() {
      return this.tradeCooldownRemainingSeconds > 0;
    },

    tradeCooldownLabel() {
      const totalSeconds = this.tradeCooldownRemainingSeconds;
      if (!totalSeconds) return "";

      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    },

    tradeCooldownChipClass() {
      return {
        "trade-cooldown-chip-partial": this.tradeCooldown.reason === "partial",
        "trade-cooldown-chip-missed": this.tradeCooldown.reason === "missed"
      };
    },

    isTradeRegistrationBlocked() {
      return this.emotionChecklist.state === "anxious" || this.tradeCooldownActive;
    },

    tradeBlockingReason() {
      if (this.emotionChecklist.state === "anxious") {
        return "Estás ansioso. No puedes operar ni registrar trades hasta volver a estar calmado.";
      }

      if (this.tradeCooldownActive) {
        if (this.tradeCooldown.reason === "partial") {
          return `Seguiste las reglas parcialmente. Quedas bloqueado por 10 minutos. Tiempo restante ${this.tradeCooldownLabel}.`;
        }

        if (this.tradeCooldown.reason === "missed") {
          return `No seguiste las reglas. Quedas bloqueado por 20 minutos. Tiempo restante ${this.tradeCooldownLabel}.`;
        }

        return `Operativa bloqueada temporalmente. Tiempo restante ${this.tradeCooldownLabel}.`;
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

    ruleChecklistTitle() {
      switch (this.tradeForm.ruleStatus) {
        case "followed":
          return "Seguiste tus reglas";
        case "partial":
          return "Seguiste las reglas parcialmente";
        case "missed":
          return "No seguiste tus reglas";
        default:
          return "Marca cómo ejecutaste el trade";
      }
    },

    ruleChecklistMessage() {
      switch (this.tradeForm.ruleStatus) {
        case "followed":
          return "Trade validado con disciplina completa. La tarjeta queda verde y suma fuerte a tu progreso semanal.";
        case "partial":
          return "Hubo cumplimiento incompleto. La tarjeta queda amarilla y suma progreso parcial en la semana.";
        case "missed":
          return "El trade rompió el plan. La tarjeta queda roja y no suma avance semanal.";
        default:
          return "Debes dejar claro si respetaste el plan antes de guardar el trade.";
      }
    },

    ruleChecklistCardClass() {
      return {
        "rule-check-card-followed": this.tradeForm.ruleStatus === "followed",
        "rule-check-card-partial": this.tradeForm.ruleStatus === "partial",
        "rule-check-card-missed": this.tradeForm.ruleStatus === "missed"
      };
    },

    taskVoiceStatusLabel() {
      return this.taskVoiceMuted ? "Tareas en mudo" : "Voz de tareas activa";
    },

    hasBrowserNotificationSupport() {
      return typeof window !== "undefined" && "Notification" in window;
    },

    newsAlertsStatusLabel() {
      if (!this.newsAlertsEnabled) {
        return "Alertas Nasdaq en pausa";
      }

      if (!this.hasBrowserNotificationSupport) {
        return "Solo aviso por voz";
      }

      if (this.notificationPermission === "granted") {
        return "Alertas Nasdaq activas";
      }

      if (this.notificationPermission === "denied") {
        return "Notificaciones bloqueadas";
      }

      return "Falta permiso del navegador";
    },

    sortedNewsReminders() {
      return [...this.newsReminders].sort((left, right) => {
        const leftDate = this.getReminderDateTime(left)?.getTime() || 0;
        const rightDate = this.getReminderDateTime(right)?.getTime() || 0;
        return leftDate - rightDate;
      });
    },

    nextNewsReminder() {
      this.currentTime;

      return this.sortedNewsReminders.find(reminder => {
        const reminderDate = this.getReminderDateTime(reminder);
        return reminderDate && reminderDate.getTime() >= Date.now();
      }) || null;
    },

    newsAlertsHelpText() {
      if (!this.newsAlertsEnabled) {
        return "Las alertas manuales están en pausa. Vuelve a activarlas para recibir avisos 15 minutos antes.";
      }

      if (!this.hasBrowserNotificationSupport) {
        return "Tu navegador no soporta notificaciones. La app puede avisarte por voz mientras esté abierta.";
      }

      if (this.notificationPermission === "granted") {
        return "Tus recordatorios manuales avisarán por notificación y voz 15 minutos antes.";
      }

      if (this.notificationPermission === "denied") {
        return "Las notificaciones están bloqueadas. Revisa el permiso del navegador o usa el aviso por voz con la app abierta.";
      }

      return "Activa el permiso del navegador si quieres recibir una notificación además del aviso por voz.";
    },

    currentWeekRuleStats() {
      // Depend on the live clock so this computed recalculates when a new day/week starts.
      this.currentTime;

      const today = new Date();
      const day = today.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      start.setDate(today.getDate() + mondayOffset);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const trades = this.trades.filter(trade => {
        const tradeDate = new Date(`${trade.date}T00:00:00`);
        return !Number.isNaN(tradeDate.getTime()) && tradeDate >= start && tradeDate <= end;
      });

      let followed = trades.filter(trade => trade.ruleStatus === "followed").length;
      let partial = trades.filter(trade => trade.ruleStatus === "partial").length;
      let missed = trades.filter(trade => trade.ruleStatus === "missed").length;

      const currentWeekKey = this.getWeekKeyForDate(today.toISOString().slice(0, 10));
      const pendingSelections = this.pendingRuleSelections.filter(selection => selection.weekKey === currentWeekKey);

      followed += pendingSelections.filter(selection => selection.status === "followed").length;
      partial += pendingSelections.filter(selection => selection.status === "partial").length;
      missed += pendingSelections.filter(selection => selection.status === "missed").length;

      const rawPercent = followed * 20 + partial * 10 - missed * 20;
      const percent = Math.min(Math.max(rawPercent, 0), 100);
      const previewLabel = pendingSelections.length ? ` · ${pendingSelections.length} toque(s)` : "";

      return {
        trades,
        followed,
        partial,
        missed,
        percent,
        label: `${followed} segui +20 · ${partial} parcial +10 · ${missed} fallo -20${previewLabel}`
      };
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
      const trades = this.sessionFilter === "All"
        ? this.trades
        : this.trades.filter(trade => trade.session === this.sessionFilter);

      return [...trades].reverse();
    },

    curveTrades() {
      return [...this.filteredTrades].reverse();
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
      return ["Lun", "Mar", "Mie", "Jue", "Vie"];
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
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const todayKey = new Date().toISOString().slice(0, 10);
      const weeksMap = new Map();

      for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
        const currentDate = new Date(year, monthIndex, dayNumber);
        const dayOfWeek = currentDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue;
        }

        const businessDayIndex = dayOfWeek - 1;
        const weekStartDate = new Date(currentDate);
        weekStartDate.setDate(currentDate.getDate() - businessDayIndex);
        const weekKey = weekStartDate.toISOString().slice(0, 10);

        if (!weeksMap.has(weekKey)) {
          weeksMap.set(weekKey, {
            key: `week-${weekKey}`,
            label: `Semana ${weeksMap.size + 1}`,
            weekStartDate,
            days: Array.from({ length: 5 }, (_, index) => ({
              key: `empty-${weekKey}-${index}`,
              isCurrentMonth: false,
              dayNumber: null,
              summary: null,
              isToday: false
            }))
          });
        }

        const dateKey = `${this.currentCalendarMonth}-${String(dayNumber).padStart(2, "0")}`;
        weeksMap.get(weekKey).days[businessDayIndex] = {
          key: dateKey,
          date: dateKey,
          dayNumber,
          isCurrentMonth: true,
          summary: this.calendarDailyStats[dateKey] || null,
          isToday: dateKey === todayKey
        };
      }

      return Array.from(weeksMap.values())
        .sort((left, right) => left.weekStartDate - right.weekStartDate)
        .map((week, index) => {
          const weekDaysWithTrades = week.days.filter(day => day.summary);

          return {
            key: week.key,
            label: `Semana ${index + 1}`,
            days: week.days,
            summary: {
              totalR: weekDaysWithTrades.reduce((sum, day) => sum + day.summary.totalR, 0),
              totalUSD: weekDaysWithTrades.reduce((sum, day) => sum + day.summary.totalUSD, 0),
              activeDays: weekDaysWithTrades.length,
              tradeCount: weekDaysWithTrades.reduce((sum, day) => sum + day.summary.tradeCount, 0)
            }
          };
        });
    },

    curveData() {
      let cumulative = 0;

      return this.curveTrades.map((trade, index) => {
        const resultR = this.getSafeR(trade.resultR);
        cumulative += resultR;

        return {
          index,
          trade,
          resultR,
          cumulative,
          title: trade.date || `Trade ${index + 1}`,
          detail: trade.session || "Sin sesión"
        };
      });
    },

    curveChartBounds() {
      if (this.curveData.length === 0) return null;

      const width = 1000;
      const height = 320;
      const paddingTop = 20;
      const paddingRight = 20;
      const paddingBottom = 26;
      const paddingLeft = 20;
      const plotWidth = width - paddingLeft - paddingRight;
      const plotHeight = height - paddingTop - paddingBottom;

      const values = this.curveData.map(point => point.cumulative);
      values.push(0);

      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const rawRange = rawMax - rawMin;
      const padding = rawRange === 0 ? 1.25 : Math.max(rawRange * 0.12, 0.6);
      const minVal = Math.min(rawMin - padding, 0);
      const maxVal = Math.max(rawMax + padding, 0);
      const range = maxVal - minVal || 1;
      const zeroLineY = this.mapCurveValueToY(0, {
        height,
        paddingBottom,
        minVal,
        range,
        plotHeight
      });

      return {
        width,
        height,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        plotWidth,
        plotHeight,
        minVal,
        maxVal,
        range,
        zeroLineY
      };
    },

    curvePoints() {
      if (!this.curveChartBounds) return [];

      return this.curveData.map((point, idx) => {
        const x = this.curveData.length === 1
          ? this.curveChartBounds.width / 2
          : this.curveChartBounds.paddingLeft
            + (idx * this.curveChartBounds.plotWidth) / (this.curveData.length - 1);

        const y = this.mapCurveValueToY(point.cumulative, this.curveChartBounds);

        return {
          ...point,
          x,
          y
        };
      });
    },

    curvePath() {
      return this.buildSmoothCurvePath(this.curvePoints);
    },

    curveAreaPath() {
      if (!this.curvePath || !this.curvePoints.length || !this.curveChartBounds) return "";

      const firstPoint = this.curvePoints[0];
      const lastPoint = this.curvePoints[this.curvePoints.length - 1];
      return `${this.curvePath} L ${lastPoint.x} ${this.curveChartBounds.zeroLineY} L ${firstPoint.x} ${this.curveChartBounds.zeroLineY} Z`;
    },

    curveGridLines() {
      if (!this.curveChartBounds) return [];

      const tickCount = 4;
      return Array.from({ length: tickCount + 1 }, (_, index) => {
        const ratio = index / tickCount;
        const value = this.curveChartBounds.maxVal - this.curveChartBounds.range * ratio;
        return {
          key: `curve-grid-${index}`,
          value,
          y: this.mapCurveValueToY(value, this.curveChartBounds),
          label: this.formatCurveValue(value)
        };
      });
    },

    activeCurvePoint() {
      if (!this.curvePoints.length || !this.curveChartBounds) return null;

      const activeIndex = this.hoveredCurveIndex ?? (this.curvePoints.length - 1);
      const point = this.curvePoints[activeIndex];
      if (!point) return null;

      const tooltipWidth = 170;
      const tooltipHeight = 62;
      const tooltipX = Math.min(
        Math.max(point.x + 14, 12),
        this.curveChartBounds.width - tooltipWidth - 12
      );
      const tooltipY = point.y < 88
        ? Math.min(point.y + 18, this.curveChartBounds.height - tooltipHeight - 10)
        : Math.max(point.y - tooltipHeight - 12, 10);

      return {
        ...point,
        tooltipX,
        tooltipY,
        title: point.title,
        cumulativeLabel: `${this.formatCurveValue(point.cumulative)} acumulado`,
        detailLabel: `${point.resultR >= 0 ? "+" : ""}${this.formatCurveValue(point.resultR)} · ${point.detail}`
      };
    },

    curveRenderKey() {
      return `${this.curveData.length}-${this.totalR}-${this.sessionFilter}`;
    },

    zeroLineY() {
      return this.curveChartBounds?.zeroLineY ?? null;
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

          const normalizedTasks = this.normalizeTasks(newTasks);

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
    if (this.hasBrowserNotificationSupport) {
      this.notificationPermission = Notification.permission;
    } else {
      this.notificationPermission = "unsupported";
    }

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

        this.tasks = this.normalizeTasks(data.tasks);
        this.trades = this.normalizeTrades(data.trades);
        this.rValue = Number(data.rValue) > 0 ? Number(data.rValue) : 50;
        this.goalUSD = Number(data.goalUSD) > 0 ? Number(data.goalUSD) : 3000;
        this.pomodoro = this.normalizePomodoroState(data.pomodoro);
        this.pomodoroGoalCelebrated = this.pomodoro.totalFocusedSeconds >= this.pomodoroTargetSeconds;
        this.emotionChecklist = this.normalizeEmotionChecklist(data.emotionChecklist);
        this.tradeCooldown = this.normalizeTradeCooldown(data.tradeCooldown);
        this.taskVoiceMuted = Boolean(data.taskVoiceMuted);
        this.newsReminders = this.normalizeNewsReminders(data.newsReminders);
        this.newsAlertsEnabled = data.newsAlertsEnabled !== false;
        this.pendingRuleSelections = this.normalizePendingRuleSelections(data.pendingRuleSelections);

        this.isHydratingFromCloud = false;
        this.syncState = "synced";
        this.lastCloudSyncAt = new Date().toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit"
        });

        this.checkNasdaqNewsAlerts(new Date());
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
    getDefaultNewsReminderForm() {
      return {
        title: "",
        date: new Date().toISOString().slice(0, 10),
        time: ""
      };
    },

    getDefaultEmotionChecklist() {
      return {
        state: ""
      };
    },

    getDefaultTradeCooldown() {
      return {
        until: "",
        reason: ""
      };
    },

    getDefaultTradeForm() {
      return {
        date: new Date().toISOString().slice(0, 10),
        session: "",
        direction: "",
        ruleStatus: "",
        resultR: 1,
        note: ""
      };
    },

    getWeekKeyForDate(dateValue = new Date().toISOString().slice(0, 10)) {
      const baseDate = new Date(`${dateValue}T00:00:00`);
      if (Number.isNaN(baseDate.getTime())) {
        return new Date().toISOString().slice(0, 10);
      }

      const day = baseDate.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() + mondayOffset);
      return monday.toISOString().slice(0, 10);
    },

    normalizePendingRuleSelections(rawSelections) {
      if (!Array.isArray(rawSelections)) return [];

      return rawSelections
        .map((selection, index) => ({
          id: String(selection?.id || `${Date.now()}-${index}`),
          weekKey: /^\d{4}-\d{2}-\d{2}$/.test(selection?.weekKey || "")
            ? selection.weekKey
            : this.getWeekKeyForDate(),
          status: this.normalizeRuleStatus(selection?.status)
        }))
        .filter(selection => selection.status);
    },

    persistPendingRuleSelections() {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      try {
        localStorage.setItem("nasdaq_pending_rule_selections", JSON.stringify(this.pendingRuleSelections));
      } catch (error) {
        console.error("Error al guardar los toques de disciplina:", error);
      }

      this.scheduleCloudSave();
    },

    normalizeNewsReminder(rawReminder) {
      const title = String(rawReminder?.title || "").trim();
      const date = /^\d{4}-\d{2}-\d{2}$/.test(rawReminder?.date || "")
        ? rawReminder.date
        : new Date().toISOString().slice(0, 10);
      const time = /^\d{2}:\d{2}$/.test(rawReminder?.time || "")
        ? rawReminder.time
        : "";

      return {
        id: String(rawReminder?.id || `${Date.now()}-${Math.random()}`),
        title,
        date,
        time,
        notifyBeforeMinutes: this.normalizePositiveNumber(rawReminder?.notifyBeforeMinutes, 15),
        alertedAt: rawReminder?.alertedAt ? String(rawReminder.alertedAt) : "",
        sourceType: "manual",
        sourceLabel: String(rawReminder?.sourceLabel || "Manual"),
        symbol: String(rawReminder?.symbol || "").toUpperCase(),
        meta: String(rawReminder?.meta || ""),
        url: String(rawReminder?.url || "")
      };
    },

    normalizeNewsReminders(rawReminders) {
      if (!Array.isArray(rawReminders)) return [];

      return rawReminders
        .map(reminder => this.normalizeNewsReminder(reminder))
        .filter(reminder => reminder.sourceType !== "api" && reminder.title && reminder.date && reminder.time);
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

    normalizeTask(rawTask, index = 0) {
      const text = String(rawTask?.text || "").trim();
      if (!text) return null;

      return {
        id: rawTask?.id || Date.now() + Math.random() + index,
        text,
        done: Boolean(rawTask?.done)
      };
    },

    normalizeTasks(rawTasks) {
      if (!Array.isArray(rawTasks)) return [];

      return rawTasks
        .map((task, index) => this.normalizeTask(task, index))
        .filter(Boolean)
        .slice(0, this.maxDailyTasks);
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

    normalizeTradeCooldown(rawTradeCooldown) {
      const nextTradeCooldown = {
        ...this.getDefaultTradeCooldown(),
        ...(rawTradeCooldown || {})
      };

      const parsedUntil = nextTradeCooldown.until ? new Date(nextTradeCooldown.until) : null;

      return {
        until: parsedUntil && !Number.isNaN(parsedUntil.getTime()) ? parsedUntil.toISOString() : "",
        reason: ["partial", "missed"].includes(nextTradeCooldown.reason) ? nextTradeCooldown.reason : ""
      };
    },

    normalizeRuleStatus(value) {
      return ["followed", "partial", "missed"].includes(value) ? value : "";
    },

    normalizeTrade(rawTrade) {
      const resultR = this.getSafeR(rawTrade?.resultR);

      return {
        id: rawTrade?.id || Date.now() + Math.random(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(rawTrade?.date || "")
          ? rawTrade.date
          : new Date().toISOString().slice(0, 10),
        session: String(rawTrade?.session || ""),
        direction: String(rawTrade?.direction || ""),
        ruleStatus: this.normalizeRuleStatus(rawTrade?.ruleStatus),
        resultR,
        resultUSD: Number.isFinite(Number(rawTrade?.resultUSD))
          ? Number(rawTrade.resultUSD)
          : resultR * this.safeRValue,
        note: String(rawTrade?.note || "")
      };
    },

    normalizeTrades(rawTrades) {
      if (!Array.isArray(rawTrades)) return [];
      return rawTrades.map(trade => this.normalizeTrade(trade));
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

    persistTradeCooldown() {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      try {
        localStorage.setItem("nasdaq_trade_cooldown", JSON.stringify(this.tradeCooldown));
      } catch (error) {
        console.error("Error al guardar el bloqueo temporal de trades:", error);
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

    persistNewsReminders() {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      try {
        localStorage.setItem("nasdaq_news_reminders", JSON.stringify(this.newsReminders));
      } catch (error) {
        console.error("Error al guardar recordatorios Nasdaq:", error);
      }

      this.scheduleCloudSave();
    },

    persistNewsAlertsEnabled() {
      if (!this.isHydratingFromCloud && !this.isLoadingLocalData) {
        this.justSavedLocallyAt = Date.now();
      }

      try {
        localStorage.setItem("nasdaq_news_alerts_enabled", JSON.stringify(this.newsAlertsEnabled));
      } catch (error) {
        console.error("Error al guardar el estado de alertas Nasdaq:", error);
      }

      this.scheduleCloudSave();
    },

    toggleTaskVoiceMuted() {
      this.taskVoiceMuted = !this.taskVoiceMuted;
      this.persistTaskVoiceMuted();
    },

    toggleNewsAlerts() {
      this.newsAlertsEnabled = !this.newsAlertsEnabled;
      this.persistNewsAlertsEnabled();

      if (this.newsAlertsEnabled) {
        this.checkNasdaqNewsAlerts(new Date());
      }
    },

    async requestNewsNotificationPermission() {
      if (!this.hasBrowserNotificationSupport) {
        alert("Tu navegador no soporta notificaciones. La app solo podrá avisarte por voz si está abierta.");
        return;
      }

      try {
        this.notificationPermission = await Notification.requestPermission();
      } catch (error) {
        console.error("Error al pedir permiso de notificaciones:", error);
        alert("No se pudo solicitar el permiso de notificaciones en este navegador.");
      }
    },

    resetNewsReminderForm() {
      this.newsReminderForm = this.getDefaultNewsReminderForm();
    },

    addNewsReminder() {
      const title = this.newsReminderForm.title.trim();
      const draftReminder = this.normalizeNewsReminder({
        ...this.newsReminderForm,
        title,
        id: `${Date.now()}-${Math.random()}`,
        sourceType: "manual",
        sourceLabel: "Manual"
      });
      const reminderDate = this.getReminderDateTime(draftReminder);

      if (!title || !draftReminder.date || !draftReminder.time) {
        alert("Completa evento, fecha y hora para crear el recordatorio Nasdaq.");
        return;
      }

      if (!reminderDate || reminderDate.getTime() <= Date.now()) {
        alert("El recordatorio debe apuntar a una hora futura.");
        return;
      }

      this.newsReminders = [...this.newsReminders, draftReminder];
      this.persistNewsReminders();
      this.resetNewsReminderForm();
    },

    removeNewsReminder(id) {
      this.newsReminders = this.newsReminders.filter(reminder => reminder.id !== id);
      this.persistNewsReminders();
    },

    getReminderDateTime(reminder) {
      if (!reminder?.date || !reminder?.time) return null;

      const reminderDate = new Date(`${reminder.date}T${reminder.time}:00`);
      return Number.isNaN(reminderDate.getTime()) ? null : reminderDate;
    },

    formatReminderDateTime(reminder) {
      const reminderDate = this.getReminderDateTime(reminder);

      if (!reminderDate) return "Fecha inválida";

      return reminderDate.toLocaleString("es-PE", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    },

    getReminderStatus(reminder) {
      this.currentTime;

      const reminderDate = this.getReminderDateTime(reminder);
      if (!reminderDate) return "Fecha inválida";

      const alertDate = new Date(reminderDate.getTime() - reminder.notifyBeforeMinutes * 60 * 1000);
      const now = Date.now();
      const minutesUntilEvent = Math.ceil((reminderDate.getTime() - now) / 60000);

      if (reminder.alertedAt) {
        return "Aviso enviado";
      }

      if (reminderDate.getTime() <= now) {
        return "Evento pasado";
      }

      if (alertDate.getTime() <= now) {
        return `Ventana activa · faltan ${Math.max(minutesUntilEvent, 0)} min`;
      }

      return `Manual · avisa ${reminder.notifyBeforeMinutes} min antes`;
    },

    sendNewsReminderAlert(reminder, reminderDate) {
      const reminderTime = reminderDate.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const message = `${reminder.title} empieza a las ${reminderTime}.`;

      if (this.hasBrowserNotificationSupport && this.notificationPermission === "granted") {
        new Notification("Alerta Nasdaq", {
          body: message,
          tag: `nasdaq-reminder-${reminder.id}`
        });
      }

      this.speakText(`Atención. ${reminder.title} comienza en quince minutos.`, {
        repeat: 2,
        pauseBetweenMs: 900
      });
    },

    checkNasdaqNewsAlerts(referenceDate = new Date()) {
      if (!this.newsAlertsEnabled || !this.newsReminders.length) return;

      const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
      const triggeredIds = [];

      this.newsReminders.forEach(reminder => {
        if (reminder.alertedAt) return;

        const reminderDate = this.getReminderDateTime(reminder);
        if (!reminderDate) return;

        const alertDate = new Date(reminderDate.getTime() - reminder.notifyBeforeMinutes * 60 * 1000);

        if (now.getTime() >= alertDate.getTime() && now.getTime() < reminderDate.getTime()) {
          triggeredIds.push(reminder.id);
          this.sendNewsReminderAlert(reminder, reminderDate);
        }
      });

      if (!triggeredIds.length) return;

      this.newsReminders = this.newsReminders.map(reminder => (
        triggeredIds.includes(reminder.id)
          ? { ...reminder, alertedAt: now.toISOString() }
          : reminder
      ));

      this.persistNewsReminders();
    },

    setEmotionState(state) {
      this.emotionChecklist = this.normalizeEmotionChecklist({ state });

      if (state === "anxious") {
        this.speakText("Estás ansioso. No puedes operar.");
      }

      this.persistEmotionChecklist();
    },

    setTradeRuleStatus(status) {
      const normalizedStatus = this.normalizeRuleStatus(status);

      this.tradeForm = {
        ...this.tradeForm,
        ruleStatus: normalizedStatus
      };

      if (!normalizedStatus) return;

      this.pendingRuleSelections = [
        ...this.pendingRuleSelections,
        {
          id: `${Date.now()}-${Math.random()}`,
          weekKey: this.getWeekKeyForDate(this.tradeForm.date),
          status: normalizedStatus
        }
      ];

      this.persistPendingRuleSelections();
    },

    getRuleStatusLabel(status) {
      switch (status) {
        case "followed":
          return "Seguiste";
        case "partial":
          return "Parcial";
        case "missed":
          return "No seguiste";
        default:
          return "Sin marcar";
      }
    },

    getRuleStatusBadgeClass(status) {
      return {
        "rule-badge-followed": status === "followed",
        "rule-badge-partial": status === "partial",
        "rule-badge-missed": status === "missed"
      };
    },

    applyTradeCooldown(ruleStatus) {
      let cooldownMinutes = 0;

      if (ruleStatus === "partial") {
        cooldownMinutes = 10;
      } else if (ruleStatus === "missed") {
        cooldownMinutes = 20;
      }

      if (!cooldownMinutes) {
        this.tradeCooldown = this.getDefaultTradeCooldown();
        this.persistTradeCooldown();
        return;
      }

      const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString();
      this.tradeCooldown = {
        until: cooldownUntil,
        reason: ruleStatus
      };
      this.lastAnnouncedTradeCooldownUntil = cooldownUntil;
      this.persistTradeCooldown();
    },

    clearExpiredTradeCooldown() {
      if (!this.tradeCooldown.until) return;

      const cooldownUntil = new Date(this.tradeCooldown.until);
      if (Number.isNaN(cooldownUntil.getTime()) || cooldownUntil.getTime() > Date.now()) return;

      const expiredReason = this.tradeCooldown.reason;
      const expiredUntil = this.tradeCooldown.until;
      this.tradeCooldown = this.getDefaultTradeCooldown();
      this.persistTradeCooldown();

      if (expiredUntil && this.lastAnnouncedTradeCooldownUntil === expiredUntil) {
        this.lastAnnouncedTradeCooldownUntil = "";
        if (expiredReason === "partial") {
          this.speakText("Terminó el bloqueo de diez minutos. Ya puedes volver a operar.");
        } else if (expiredReason === "missed") {
          this.speakText("Terminó el bloqueo de veinte minutos. Ya puedes volver a operar.");
        } else {
          this.speakText("Terminó el bloqueo temporal. Ya puedes volver a operar.");
        }
      }
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

    formatCurveValue(value) {
      return `${this.formatCalendarValue(value, "R")}`;
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
      const newsCheckKey = now.toISOString().slice(0, 16);

      this.currentTime = now.toLocaleTimeString("es-PE", {
        hour12: false
      });

      this.todayDate = now.toLocaleDateString("es-PE");
  this.clearExpiredTradeCooldown();
      this.tickPomodoro();

      const seconds = now.getSeconds();
      const minute = now.getMinutes();
      if (seconds === 0 && minute % 5 === 0 && minute !== this.lastSpokenMinute) {
        this.lastSpokenMinute = minute;
        this.announceCompletedTasks();
      }

      if (newsCheckKey !== this.lastNewsAlertCheckKey) {
        this.lastNewsAlertCheckKey = newsCheckKey;
        this.checkNasdaqNewsAlerts(now);
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
          this.tasks = this.normalizeTasks(parsed);
        }

        const savedTrades = localStorage.getItem("nasdaq_trades_curve");
        if (savedTrades) {
          const parsedTrades = JSON.parse(savedTrades);
          this.trades = this.normalizeTrades(parsedTrades);
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

        const savedTradeCooldown = localStorage.getItem("nasdaq_trade_cooldown");
        if (savedTradeCooldown) {
          this.tradeCooldown = this.normalizeTradeCooldown(JSON.parse(savedTradeCooldown));
        }

        const savedTaskVoiceMuted = localStorage.getItem("nasdaq_task_voice_muted");
        if (savedTaskVoiceMuted) {
          this.taskVoiceMuted = Boolean(JSON.parse(savedTaskVoiceMuted));
        }

        const savedNewsReminders = localStorage.getItem("nasdaq_news_reminders");
        if (savedNewsReminders) {
          this.newsReminders = this.normalizeNewsReminders(JSON.parse(savedNewsReminders));
        }

        const savedNewsAlertsEnabled = localStorage.getItem("nasdaq_news_alerts_enabled");
        if (savedNewsAlertsEnabled) {
          this.newsAlertsEnabled = JSON.parse(savedNewsAlertsEnabled) !== false;
        }

        const savedPendingRuleSelections = localStorage.getItem("nasdaq_pending_rule_selections");
        if (savedPendingRuleSelections) {
          this.pendingRuleSelections = this.normalizePendingRuleSelections(JSON.parse(savedPendingRuleSelections));
        }
      } catch (error) {
        console.error("Error al leer datos locales:", error);
      } finally {
        this.isLoadingLocalData = false;
      }

      this.checkNasdaqNewsAlerts(new Date());
    },

    getSafeR(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    },

    mapCurveValueToY(value, bounds) {
      return bounds.height
        - bounds.paddingBottom
        - ((value - bounds.minVal) / bounds.range) * bounds.plotHeight;
    },

    buildSmoothCurvePath(points) {
      if (!points.length) return "";
      if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`;
      }

      const path = [`M ${points[0].x} ${points[0].y}`];

      for (let index = 0; index < points.length - 1; index += 1) {
        const current = points[index];
        const next = points[index + 1];
        const previous = points[index - 1] || current;
        const afterNext = points[index + 2] || next;

        const controlPoint1X = current.x + (next.x - previous.x) / 6;
        const controlPoint1Y = current.y + (next.y - previous.y) / 6;
        const controlPoint2X = next.x - (afterNext.x - current.x) / 6;
        const controlPoint2Y = next.y - (afterNext.y - current.y) / 6;

        path.push(
          `C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${next.x} ${next.y}`
        );
      }

      return path.join(" ");
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

      // Guardar inmediatamente en lugar de esperar 500ms
      this.saveToCloud();
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
            tasks: this.normalizeTasks(this.tasks),
            trades: this.trades,
            pomodoro: this.pomodoro,
            emotionChecklist: this.emotionChecklist,
            tradeCooldown: this.tradeCooldown,
            taskVoiceMuted: this.taskVoiceMuted,
            newsReminders: this.newsReminders,
            newsAlertsEnabled: this.newsAlertsEnabled,
            pendingRuleSelections: this.pendingRuleSelections,
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

      if (this.taskLimitReached) {
        alert(`Solo puedes tener ${this.maxDailyTasks} tareas por día.`);
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

    resetTradeForm(options = {}) {
      const { preserveSelection = true } = options;
      const previousTradeForm = this.tradeForm;

      this.tradeForm = {
        ...this.getDefaultTradeForm(),
        session: preserveSelection ? previousTradeForm.session : "",
        direction: preserveSelection ? previousTradeForm.direction : ""
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
        ruleStatus: this.normalizeRuleStatus(this.tradeForm.ruleStatus),
        resultR,
        resultUSD: resultR * this.safeRValue,
        note: this.tradeForm.note.trim()
      };

      if (!tradePayload.date || !tradePayload.session || !tradePayload.direction) {
        alert("Completa fecha, sesión y dirección.");
        return;
      }

      if (!tradePayload.ruleStatus) {
        alert("Marca si seguiste la regla, la seguiste parcialmente o no la seguiste.");
        return;
      }

      if (this.isEditing) {
        this.trades = this.trades.map(trade =>
          trade.id === this.editingTradeId ? tradePayload : trade
        );
      } else {
        this.trades = [...this.trades, tradePayload];
      }

      const tradeWeekKey = this.getWeekKeyForDate(tradePayload.date);
      const pendingIndex = this.pendingRuleSelections.findIndex(selection => (
        selection.weekKey === tradeWeekKey && selection.status === tradePayload.ruleStatus
      ));

      if (pendingIndex !== -1) {
        this.pendingRuleSelections = this.pendingRuleSelections.filter((_, index) => index !== pendingIndex);
        this.persistPendingRuleSelections();
      }

      this.justSavedLocallyAt = Date.now();
      this.applyTradeCooldown(tradePayload.ruleStatus);
      this.resetTradeForm();
      // El watcher de trades se encarga de saveToCloud y scheduleCloudSave
    },

    editTrade(trade) {
      this.tradeForm = {
        date: trade.date,
        session: trade.session,
        direction: trade.direction,
        ruleStatus: this.normalizeRuleStatus(trade.ruleStatus),
        resultR: trade.resultR,
        note: trade.note
      };

      this.isEditing = true;
      this.editingTradeId = trade.id;
    },

    removeTrade(id) {
      this.justSavedLocallyAt = Date.now();
      this.trades = this.trades.filter(trade => trade.id !== id);

      try {
        localStorage.setItem("nasdaq_trades_curve", JSON.stringify(this.trades));
      } catch (error) {
        console.error("Error guardando cambios de trades:", error);
      }

      if (this.isEditing && this.editingTradeId === id) {
        this.resetTradeForm({ preserveSelection: false });
      }

      // Guardar inmediatamente en la nube, sin esperar
      this.saveToCloud();
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

    speakText(text, options = {}) {
      const { repeat = 1, pauseBetweenMs = 0 } = options;
      const safeRepeat = Math.max(1, Math.round(Number(repeat) || 1));
      const safePauseBetweenMs = Math.max(0, Math.round(Number(pauseBetweenMs) || 0));
      const sequenceToken = Date.now() + Math.random();

      this.speechSequenceToken = sequenceToken;
      if (this.speechRepeatTimer) {
        clearTimeout(this.speechRepeatTimer);
        this.speechRepeatTimer = null;
      }
      window.speechSynthesis.cancel();

      const voices = this.availableVoices.length > 0 ? this.availableVoices : window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(voice => voice.lang.startsWith("es"));

      const speakIteration = iteration => {
        if (this.speechSequenceToken !== sequenceToken) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "es-MX";
        utterance.rate = 0.9;
        utterance.pitch = 0.95;
        utterance.volume = 1.0;

        if (spanishVoice) {
          utterance.voice = spanishVoice;
        }

        utterance.onend = () => {
          if (this.speechSequenceToken !== sequenceToken) return;
          if (iteration >= safeRepeat - 1) return;

          this.speechRepeatTimer = window.setTimeout(() => {
            this.speechRepeatTimer = null;
            speakIteration(iteration + 1);
          }, safePauseBetweenMs);
        };

        window.speechSynthesis.speak(utterance);
      };

      speakIteration(0);
    },

    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }
  }
};