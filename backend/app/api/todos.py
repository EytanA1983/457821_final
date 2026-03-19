from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.api.deps import get_current_user
from app.api.deps_audit import get_audit_context
from app.services.audit import audit_service, AuditAction
from app.db.models import Todo, Task, User
from app.schemas.todo import TodoCreate, TodoRead, TodoUpdate

router = APIRouter(prefix="/api/todos", tags=["todos"])

@router.get("/task/{task_id}", response_model=List[TodoRead])
def list_todos(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    List todos (sub-tasks) for a specific task.
    
    Todo = רשימות משנה של Task (sub-tasks)
    - קשור ל-Task דרך task_id
    - משמש לרשימות משנה/צ'קליסטים בתוך משימה
    """
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    # Order todos by position
    return sorted(task.todos, key=lambda t: (t.position or 0, t.id))

@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(
    request: Request,
    todo_in: TodoCreate,
    task_id: int = Query(..., description="Task ID for the todo"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    todo = Todo(**todo_in.dict(), task_id=task.id)
    db.add(todo)
    db.flush()  # Flush to get the ID

    # Create audit log
    new_values = todo_in.dict()
    new_values["task_id"] = task.id
    audit_service.create_audit_log(
        session=db,
        instance=todo,
        action=AuditAction.CREATE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        new_values=new_values,
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.commit()
    db.refresh(todo)
    return todo

@router.put("/{todo_id}", response_model=TodoRead)
def update_todo(
    request: Request,
    todo_id: int,
    todo_in: TodoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    todo = (
        db.query(Todo)
        .join(Task)
        .filter(Todo.id == todo_id, Task.user_id == user.id)
        .first()
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    # Get changed fields before update
    changed_fields = audit_service.get_changed_fields(todo, db)

    # Update todo
    for key, value in todo_in.dict(exclude_unset=True).items():
        setattr(todo, key, value)

    db.flush()  # Flush to get updated values

    # Get new changed fields after update
    changed_fields = audit_service.get_changed_fields(todo, db)

    if changed_fields:
        # Prepare old and new values
        old_values = {field: data["old"] for field, data in changed_fields.items()}
        new_values = {field: data["new"] for field, data in changed_fields.items()}

        # Create audit log
        audit_service.create_audit_log(
            session=db,
            instance=todo,
            action=AuditAction.UPDATE,
            user_id=audit_context["user_id"],
            user_email=audit_context["user_email"],
            old_values=old_values,
            new_values=new_values,
            changed_fields=changed_fields,
            ip_address=audit_context["ip_address"],
            user_agent=audit_context["user_agent"],
        )

    db.commit()
    db.refresh(todo)
    return todo


@router.put("/{todo_id}/complete", response_model=TodoRead)
def set_todo_completed(
    request: Request,
    todo_id: int,
    completed: bool = Query(True, description="Set completed=true/false"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    """Mark a todo as completed/uncompleted."""
    todo = (
        db.query(Todo)
        .join(Task)
        .filter(Todo.id == todo_id, Task.user_id == user.id)
        .first()
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    # Get old value before update
    old_completed = todo.completed
    todo.completed = completed

    # Create audit log for completion change
    audit_service.create_audit_log(
        session=db,
        instance=todo,
        action=AuditAction.UPDATE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        old_values={"completed": old_completed},
        new_values={"completed": completed},
        changed_fields={"completed": {"old": old_completed, "new": completed}},
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.commit()
    db.refresh(todo)
    return todo

@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    request: Request,
    todo_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    todo = (
        db.query(Todo)
        .join(Task)
        .filter(Todo.id == todo_id, Task.user_id == user.id)
        .first()
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    # Create audit log before delete
    old_values = {
        "text": todo.text,
        "completed": todo.completed,
        "task_id": todo.task_id,
        "position": todo.position if hasattr(todo, 'position') else None,
    }
    audit_service.create_audit_log(
        session=db,
        instance=todo,
        action=AuditAction.DELETE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        old_values=old_values,
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.delete(todo)
    db.commit()
    return None
