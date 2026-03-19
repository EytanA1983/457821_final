/**
 * Calendar Page Component
 * FullCalendar view for tasks with week/month views and drag & drop
 */
import React, { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import heLocale from '@fullcalendar/core/locales/he';
import { EventInput, DateSelectArg, EventChangeArg } from '@fullcalendar/core';
import axios from 'axios';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useVoice } from '../hooks/useVoice';
import { showError, showPromise, showInfo } from '../utils/toast';
import { CalendarEvent } from '../schemas/calendar';
import { getAccessToken } from '../utils/tokenStorage';

interface Task {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  category_id?: number;
  room_id?: number;
}

function logAxios(err: unknown, label: string) {
  if (axios.isAxiosError(err)) {
    const fullUrl = err.config?.baseURL
      ? `${err.config.baseURL}${err.config.url || ''}`
      : err.config?.url;
    console.error(label, {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      method: err.config?.method?.toUpperCase(),
      fullURL: fullUrl,
      data: err.response?.data,
    });
    return;
  }
  console.error(label, err);
}

export const CalendarPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { speak } = useVoice();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarUnavailable, setCalendarUnavailable] = useState(false);
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'>('dayGridMonth');
  const calendarRef = useRef<FullCalendar | null>(null);
  const isEnglish = (i18n.resolvedLanguage || i18n.language || 'he').startsWith('en');
  const calendarLocale = isEnglish ? 'en' : 'he';
  const calendarDirection = isEnglish ? 'ltr' : 'rtl';
  const text = isEnglish
    ? {
        untitledEvent: 'Untitled event',
        taskTitlePrompt: 'Task title',
        taskUpdated: 'Task date updated',
        taskUpdateError: 'Error updating task date',
        taskPrefix: 'Task',
        descriptionPrefix: 'Description',
        createGoogleFromTask: 'Create a Google Calendar event from this task?',
        createTaskFromEvent: (summary: string) => `Create a task from "${summary}"?`,
        creatingTaskFromEvent: 'Creating task from event...',
        taskCreatedFromEvent: 'Task created from event',
        noTaskDueDate: 'Task has no due date.',
        creatingGoogleEvent: 'Creating Google Calendar event...',
        googleEventCreated: 'Google Calendar event created',
        googleEventCreateFail: 'Failed to create Google Calendar event',
        failedCreateEvent: 'We could not create the calendar event.',
        eventCreateErrorSpeak: 'Error creating event',
        taskCreatedSpeak: 'Task created',
        noCalendarConnected: 'Google Calendar is not connected.',
      }
    : {
        untitledEvent: 'אירוע ללא שם',
        taskTitlePrompt: 'כותרת המשימה',
        taskUpdated: 'תאריך המשימה עודכן',
        taskUpdateError: 'שגיאה בעדכון תאריך',
        taskPrefix: 'משימה',
        descriptionPrefix: 'תיאור',
        createGoogleFromTask: 'ליצור אירוע ב-Google Calendar מהמשימה הזו?',
        createTaskFromEvent: (summary: string) => `ליצור משימה מהאירוע "${summary}"?`,
        creatingTaskFromEvent: 'יוצר משימה מהאירוע...',
        taskCreatedFromEvent: 'משימה נוצרה מהאירוע',
        noTaskDueDate: 'למשימה אין תאריך יעד.',
        creatingGoogleEvent: 'יוצר אירוע ב-Google Calendar...',
        googleEventCreated: 'אירוע נוצר ב-Google Calendar',
        googleEventCreateFail: 'שגיאה ביצירת אירוע ב-Google Calendar',
        failedCreateEvent: 'לא הצלחנו ליצור אירוע ביומן.',
        eventCreateErrorSpeak: 'שגיאה ביצירת אירוע',
        taskCreatedSpeak: 'משימה נוצרה',
        noCalendarConnected: 'Google Calendar לא מחובר.',
      };

  const handleViewChange = (nextView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek') => {
    setView(nextView);
    const apiRef = calendarRef.current?.getApi();
    if (apiRef) {
      apiRef.changeView(nextView);
    }
  };

  useEffect(() => {
    if (!getAccessToken()) {
      setTasks([]);
      setCalendarEvents([]);
      setLoading(false);
      return;
    }
    loadTasks();
    loadCalendarEvents();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/tasks');
      setTasks(data || []);
    } catch (error: unknown) {
      logAxios(error, '[CalendarPage] Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      // Load Google Calendar events
      const { data } = await api.get<CalendarEvent[]>('/google-calendar/events', {
        params: { limit: 50 }, // Get more events for calendar view
      });
      setCalendarEvents(data || []);
      setCalendarUnavailable(false);
    } catch (error: unknown) {
      logAxios(error, '[CalendarPage] Failed to load google calendar events');
      const status = (error as any)?.response?.status;
      if (status === 404 || status === 401) {
        setCalendarUnavailable(true);
      }
      setCalendarEvents([]);
    }
  };

  // Convert tasks to FullCalendar events (overlay)
  const taskEvents: EventInput[] = tasks
    .filter((task) => task.due_date && !task.completed)
    .map((task) => ({
      id: `task-${task.id}`,
      title: `✓ ${task.title}`,
      start: task.due_date,
      end: task.due_date ? new Date(new Date(task.due_date).getTime() + 60 * 60 * 1000).toISOString() : undefined,
      backgroundColor: task.completed ? '#9CA3AF' : '#8B4513',
      borderColor: task.completed ? '#6B7280' : '#6B4513',
      extendedProps: {
        type: 'task',
        taskId: task.id,
        description: task.description,
        completed: task.completed,
        categoryId: task.category_id,
        roomId: task.room_id,
      },
    }));

  // Convert Google Calendar events to FullCalendar events
  const googleEvents: EventInput[] = calendarEvents.map((event) => ({
    id: `event-${event.id}`,
    title: event.summary || text.untitledEvent,
    start: event.start,
    end: event.end || event.start,
    backgroundColor: '#3B82F6', // Blue for calendar events
    borderColor: '#2563EB',
    extendedProps: {
      type: 'calendar',
      eventId: event.id,
      description: event.description,
      location: event.location,
      htmlLink: event.htmlLink,
    },
  }));

  // Combine tasks and calendar events
  const events: EventInput[] = [...taskEvents, ...googleEvents];

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    // Create new task on date selection
    const title = window.prompt(t('tasks:task_title') || text.taskTitlePrompt);
    if (title) {
      createTaskOnDate(title, selectInfo.start);
    }
    selectInfo.view.calendar.unselect();
  };

  const handleEventDrop = async (eventInfo: EventChangeArg) => {
    const taskId = Number(eventInfo.event.extendedProps.taskId);
    const newDate = eventInfo.event.start;

    if (!newDate || !Number.isFinite(taskId)) {
      return;
    }

    const promise = api.put(`/tasks/${taskId}`, {
      due_date: newDate.toISOString(),
    });

    showPromise(
      promise,
      {
        loading: t('toast:updating_task_date') || 'מעדכן תאריך משימה...',
        success: t('toast:task_date_updated') || 'תאריך המשימה עודכן בהצלחה',
        error: t('toast:task_date_update_failed') || 'שגיאה בעדכון תאריך המשימה',
      },
      t
    );

    try {
      await promise;

      // Update local state
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, due_date: newDate.toISOString() } : task
        )
      );

      speak(text.taskUpdated);
    } catch (error: unknown) {
      logAxios(error, '[CalendarPage] Failed to update task date');
      // Revert event position
      eventInfo.revert();
      speak(text.taskUpdateError);
    }
  };

  const handleEventResize = async (eventInfo: EventChangeArg) => {
    const taskId = Number(eventInfo.event.extendedProps.taskId);
    const newEndDate = eventInfo.event.end;

    if (!newEndDate || !Number.isFinite(taskId)) {
      return;
    }

    const promise = api.put(`/tasks/${taskId}`, {
      due_date: newEndDate.toISOString(),
    });

    showPromise(
      promise,
      {
        loading: t('toast:updating_task_date') || 'מעדכן תאריך משימה...',
        success: t('toast:task_date_updated') || 'תאריך המשימה עודכן בהצלחה',
        error: t('toast:task_date_update_failed') || 'שגיאה בעדכון תאריך המשימה',
      },
      t
    );

    try {
      await promise;

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, due_date: newEndDate.toISOString() } : task
        )
      );

      speak(text.taskUpdated);
    } catch (error: unknown) {
      logAxios(error, '[CalendarPage] Failed to resize/update task date');
      eventInfo.revert();
      speak(text.taskUpdateError);
    }
  };

  const handleEventClick = async (clickInfo: any) => {
    const eventType = clickInfo.event.extendedProps.type;
    
    if (eventType === 'task') {
      // Task clicked - show info and offer to create calendar event
      const taskId = clickInfo.event.extendedProps.taskId;
      const task = tasks.find(t => t.id === taskId);
      const description = clickInfo.event.extendedProps.description || '';
      
      if (task && task.due_date) {
        const shouldCreateEvent = window.confirm(
          `${text.taskPrefix}: ${clickInfo.event.title}\n${description ? `${text.descriptionPrefix}: ${description}\n` : ''}\n${text.createGoogleFromTask}`
        );
        
        if (shouldCreateEvent) {
          await createEventFromTask(task);
        }
      } else {
        showInfo(
          `${clickInfo.event.title}${description ? `: ${description}` : ''}`,
          t
        );
      }
    } else if (eventType === 'calendar') {
      // Calendar event clicked - offer to create task
      const eventData = {
        summary: clickInfo.event.title,
        description: clickInfo.event.extendedProps.description || '',
        start: clickInfo.event.start?.toISOString() || '',
        end: clickInfo.event.end?.toISOString() || '',
      };
      
      const shouldCreate = window.confirm(text.createTaskFromEvent(eventData.summary));
      
      if (shouldCreate) {
        await createTaskFromEvent(eventData);
      }
    }
  };

  const createTaskFromEvent = async (event: { summary: string; description?: string; start: string; end?: string }) => {
    const promise = api.post('/tasks', {
      title: event.summary,
      description: event.description || '',
      due_date: event.start,
    });

    showPromise(
      promise,
      {
        loading: t('toast:creating_task') || text.creatingTaskFromEvent,
        success: t('toast:task_created') || text.taskCreatedFromEvent,
        error: t('toast:task_creation_failed') || 'שגיאה ביצירת משימה מהאירוע',
      },
      t
    );

    try {
      await promise;
      await loadTasks();
      speak(text.taskCreatedFromEvent);
    } catch (error: unknown) {
      logAxios(error, '[CalendarPage] Failed to create task from event');
      speak(t('toast:task_creation_failed') || 'שגיאה ביצירת משימה');
    }
  };

  // Create Google Calendar event from task (optional feature)
  const createEventFromTask = async (task: Task) => {
    if (!task.due_date) {
      showError(text.noTaskDueDate);
      return;
    }

    try {
      // Create event for this specific task
      const promise = api.post(`/google-calendar/sync-tasks?task_id=${task.id}`);
      
      showPromise(
        promise,
        {
          loading: text.creatingGoogleEvent,
          success: text.googleEventCreated,
          error: text.googleEventCreateFail,
        },
        t
      );

      await promise;
      await loadCalendarEvents(); // Reload calendar events
      speak(text.googleEventCreated);
    } catch (error: unknown) {
      logAxios(error, '[CalendarPage] Failed to create event from task');
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.detail
        : undefined;
      showError(detail || text.failedCreateEvent);
      speak(text.eventCreateErrorSpeak);
    }
  };

  const createTaskOnDate = async (title: string, date: Date) => {
    const promise = api.post('/tasks', {
      title,
      due_date: date.toISOString(),
    });

    showPromise(
      promise,
      {
        loading: t('toast:creating_task') || 'יוצר משימה...',
        success: t('toast:task_created') || 'משימה נוצרה בהצלחה',
        error: t('toast:task_creation_failed') || 'שגיאה ביצירת משימה',
      },
      t
    );

    try {
      await promise;
      await loadTasks();
      speak(text.taskCreatedSpeak);
    } catch (error: unknown) {
      logAxios(error, '[CalendarPage] Failed to create task');
      speak('שגיאה ביצירת משימה');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">{t('common:loading')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-cream dark:bg-dark-bg min-h-screen">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-lg p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text">
            {t('calendar:title')}
          </h1>
          <div className="flex gap-2 flex-wrap">
            {calendarUnavailable && (
              <span className="text-sm text-amber-600 dark:text-amber-300">
                {text.noCalendarConnected}
              </span>
            )}
            <button
              onClick={() => handleViewChange('dayGridMonth')}
              className={`px-4 py-2 rounded-lg ${
                view === 'dayGridMonth' 
                  ? 'bg-mint text-white' 
                  : 'bg-gray-200 dark:bg-dark-surface text-gray-700 dark:text-dark-text'
              }`}
            >
              {t('calendar:month')}
            </button>
            <button
              onClick={() => handleViewChange('timeGridWeek')}
              className={`px-4 py-2 rounded-lg ${
                view === 'timeGridWeek' ? 'bg-mint text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t('calendar:week')}
            </button>
            <button
              onClick={() => handleViewChange('timeGridDay')}
              className={`px-4 py-2 rounded-lg ${
                view === 'timeGridDay' ? 'bg-mint text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t('calendar:day')}
            </button>
            <button
              onClick={() => handleViewChange('listWeek')}
              className={`px-4 py-2 rounded-lg ${
                view === 'listWeek' ? 'bg-mint text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {t('calendar:list')}
            </button>
          </div>
        </div>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          locales={[heLocale]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          locale={calendarLocale}
          direction={calendarDirection}
          editable={true}
          selectable={true}
          droppable={true}
          events={events}
          select={handleDateSelect}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={true}
          moreLinkClick="popover"
          eventColor="#8B4513"
          eventTextColor="#FFFFFF"
          datesSet={(arg) => {
            const nextView = arg.view.type as 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
            if (nextView !== view) {
              setView(nextView);
            }
          }}
          businessHours={{
            daysOfWeek: [0, 1, 2, 3, 4, 5], // Sunday to Thursday
            startTime: '08:00',
            endTime: '20:00',
          }}
        />
      </div>
    </div>
  );
};

export default CalendarPage;
