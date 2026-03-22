import { useCallback, useRef, useState } from "react";
import type { Task } from "../app/types";
import { useTranslation } from "react-i18next";

function swipeDeferThresholdPx(): number {
  if (typeof window === "undefined") return 56;
  try {
    return window.matchMedia("(pointer: coarse)").matches ? 44 : 56;
  } catch {
    return 56;
  }
}

export type DashboardDailyTaskCardProps = {
  task: Task;
  categoryLabel: string;
  onCompleteClick: () => void;
  /** Swipe horizontally (or drag with pointer) to defer task to next day at same time. */
  onDeferToNextDay?: () => void;
  /** Edit/delete (real persisted tasks only). */
  showActions?: boolean;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
};

export default function DashboardDailyTaskCard({
  task,
  categoryLabel,
  onCompleteClick,
  onDeferToNextDay,
  showActions = false,
  onEditClick,
  onDeleteClick,
}: DashboardDailyTaskCardProps) {
  const { t: td } = useTranslation("dashboard");
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; pointerId: number | null }>({
    active: false,
    startX: 0,
    startY: 0,
    pointerId: null,
  });

  const isDone = Boolean(task.completed);
  const canDefer = Boolean(onDeferToNextDay) && !isDone;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canDefer) return;
      const tEl = e.target as HTMLElement;
      if (tEl.closest("button")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
      };
      setDragOffsetX(0);
    },
    [canDefer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active || !canDefer) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 0.85) {
        setDragOffsetX(Math.max(-72, Math.min(72, dx)));
      }
    },
    [canDefer],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      setDragOffsetX(0);
      if (
        onDeferToNextDay &&
        Math.abs(dx) >= swipeDeferThresholdPx() &&
        Math.abs(dx) > Math.abs(dy) * 1.05
      ) {
        onDeferToNextDay();
      }
    },
    [onDeferToNextDay],
  );

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragOffsetX(0);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className={`dashboard-daily-task-card__swipe-shell${dragOffsetX !== 0 ? " dashboard-daily-task-card__swipe-shell--dragging" : ""}`}
      style={
        dragOffsetX
          ? ({ transform: `translateX(${dragOffsetX}px)`, touchAction: "none" } as React.CSSProperties)
          : ({ touchAction: canDefer ? "pan-y" : undefined } as React.CSSProperties)
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={onPointerCancel}
    >
      <div className={`dashboard-daily-task-card${isDone ? " dashboard-daily-task-card--completed" : ""}`}>
        <div className="dashboard-daily-task-card__body">
          <p className="dashboard-daily-task-card__title">{task.title}</p>
          <div className="dashboard-daily-task-card__meta-row">
            <span className="dashboard-daily-task-card__tag">{categoryLabel}</span>
            {task.scheduledTime ? (
              <span className="dashboard-daily-task-card__time" aria-label={td("taskTimeAria", { time: task.scheduledTime })}>
                {task.scheduledTime}
              </span>
            ) : null}
          </div>
          {showActions && !isDone ? (
            <div className="dashboard-daily-task-card__actions">
              <button type="button" className="dashboard-daily-task-card__action" onClick={() => onEditClick?.()}>
                {td("taskActionEdit")}
              </button>
              <button type="button" className="dashboard-daily-task-card__action dashboard-daily-task-card__action--danger" onClick={() => onDeleteClick?.()}>
                {td("taskActionDelete")}
              </button>
            </div>
          ) : null}
          {canDefer ? (
            <button
              type="button"
              className="dashboard-daily-task-card__defer"
              onClick={() => onDeferToNextDay?.()}
            >
              {td("taskDeferButton")}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="dashboard-daily-task-card__check"
          aria-label={isDone ? td("markCompleteDoneAria", { title: task.title }) : td("markCompleteAria", { title: task.title })}
          onClick={onCompleteClick}
          disabled={isDone}
        >
          <span className={`dashboard-daily-task-card__circle${isDone ? " dashboard-daily-task-card__circle--done" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" className="dashboard-daily-task-card__check-icon" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12.5l4 4 8-9"
              />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}
