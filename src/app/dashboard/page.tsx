'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
  rectIntersection,
  DragStartEvent,
} 
from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Task {
  id: string
  title: string
  description: string
  status: string
  created_at: string
}

interface User {
  id: string
  email?: string
}

interface SortableTaskProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  isEditing: boolean
  editingTask: Task | null
  onUpdate: (e: React.FormEvent) => void
  onCancelEdit: () => void
  setEditingTask: (task: Task | null) => void
}

interface DroppableColumnProps {
  status: string
  title: string
  emoji: string
  tasks: Task[]
  children: React.ReactNode
}

function DroppableColumn({ status, title, emoji, tasks, children }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
  })

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700 flex items-center">
          {emoji} {title} <span className="ml-2 text-sm bg-gray-100 px-2 py-1 rounded">{tasks.length}</span>
        </h3>
      </div>
      <div
        ref={setNodeRef}
        className={`p-4 space-y-3 min-h-[300px] transition-all duration-200 ${
          isOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : 'border-2 border-transparent'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function SortableTask({ 
  task, 
  onEdit, 
  onDelete, 
  isEditing, 
  editingTask, 
  onUpdate, 
  onCancelEdit, 
  setEditingTask 
}: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  if (isEditing && editingTask?.id === task.id) {
    return (
      <div ref={setNodeRef} style={style} className="bg-white p-4 rounded-lg shadow-sm border text-gray-400">
        <form onSubmit={onUpdate} className="space-y-3">
          <input
            type="text"
            value={editingTask.title}
            onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <textarea
            value={editingTask.description}
            onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            rows={2}
          />
          <div className="flex space-x-2">
            <button
              type="submit"
              className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-1 bg-white-600 text-black text-xs rounded-lg hover:bg-gray-700 shadow-sm border"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-lg shadow-sm border cursor-move hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2">{task.title}</h3>
        <div className="flex space-x-1 ml-2">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit(task)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="px-3 py-2 bg-violet-200 text-black shadow-sm text-xs rounded-xl hover:bg-violet-300 border-"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(task.id)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="px-2 py-2 bg-violet-300 text-black text-xs rounded-xl hover:bg-violet-400 shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-3">{task.description}</p>
      )}
      <div className="text-xs text-gray-500">
        {new Date(task.created_at).toLocaleDateString()}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [nickname, setNickname] = useState<string>('User') // Add nickname state
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState({ title: '', description: '', status: 'pending' })
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Debug: Log the entire user object to see what's available
      console.log('Full user object:', user)
      console.log('User metadata:', user.user_metadata)
      console.log('User metadata nickname:', user.user_metadata?.nickname)

      setUser(user)
      
      // Try multiple ways to get the nickname
      let userNickname = 'User' // Default fallback
      
      // Method 1: From user metadata
      if (user.user_metadata?.nickname) {
        userNickname = user.user_metadata.nickname
        console.log('Found nickname in metadata:', userNickname)
      } 
      // Method 2: Try from database as fallback
      else {
        console.log('No nickname in metadata, trying database...')
        try {
          const { data: profile } = await supabase
            .from('profiles') // Replace with your actual table name
            .select('nickname')
            .eq('id', user.id)
            .single()
          
          console.log('Profile data from database:', profile)
          
          if (profile?.nickname) {
            userNickname = profile.nickname
            console.log('Found nickname in database:', userNickname)
          }
        } catch (error) {
          console.error('Error fetching from database:', error)
        }
      }
      
      console.log('Final nickname being set:', userNickname)
      setNickname(userNickname)
      
      fetchTasks(user.id)
    }

    checkUser()
  }, [router])

  const fetchTasks = async (userId: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tasks:', error)
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newTask.title.trim()) return

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          title: newTask.title,
          description: newTask.description,
          status: newTask.status,
          user_id: user.id
        }
      ])
      .select()

    if (error) {
      console.error('Error adding task:', error)
    } else {
      setTasks([...data, ...tasks])
      setNewTask({ title: '', description: '', status: 'pending' })
    }
  }

  const updateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTask) return

    const { error } = await supabase
      .from('tasks')
      .update({
        title: editingTask.title,
        description: editingTask.description,
        status: editingTask.status
      })
      .eq('id', editingTask.id)

    if (error) {
      console.error('Error updating task:', error)
    } else {
      setTasks(tasks.map(task => 
        task.id === editingTask.id ? editingTask : task
      ))
      setEditingTask(null)
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId)
    
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)

    if (error) {
      console.error('Error updating task status:', error)
    } else {
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ))
    }
    
    setUpdatingTaskId(null)
  }

  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting task:', error)
    } else {
      setTasks(tasks.filter(task => task.id !== id))
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const task = tasks.find(t => t.id === active.id)
    setActiveTask(task || null)
  }



 const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event
  setActiveTask(null)

  if (!over) return

  const activeTaskId = active.id as string
  const overContainerId = over.id as string

  // If dropped on a container (status column)
  if (['pending', 'in-progress', 'completed'].includes(overContainerId)) {
    const task = tasks.find(t => t.id === activeTaskId)
    if (task && task.status !== overContainerId) {
      // Only update in database - real-time subscription will update UI
      updateTaskStatus(activeTaskId, overContainerId)
    }
  }
}
  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  const pendingTasks = getTasksByStatus('pending')
  const inProgressTasks = getTasksByStatus('in-progress')
  const completedTasks = getTasksByStatus('completed')
  const activeTasks = pendingTasks.length + inProgressTasks.length

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Hover trigger area */}
      <div
        className="fixed left-0 top-0 w-4 h-full z-30 bg-transparent"
        onMouseEnter={() => setSidebarOpen(true)}
      ></div>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        onMouseLeave={() => setSidebarOpen(false)}
      >
        <div className="flex flex-col h-full">
          {/* User Profile Section */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {nickname}
                </h3>
               
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              <li>
                <a
                  href="/dashboard/tasks"
                  className="flex items-center space-x-3 px-4 py-3 text-sm font-medium text-white bg-violet-400 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Tasks</span>
                </a>
              </li>
            </ul>
          </nav>

          {/* Sign Out Button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={signOut}
              className="flex items-center space-x-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="transition-all duration-300">
        <div className="max-w-7xl mx-auto py-8 px-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center">
              {/* Hamburger Button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Task Tracker</h1>
                <p className="text-gray-600">Welcome, {nickname} • {activeTasks} active tasks</p>
              </div>
            </div>
            
          </div>

          {/* Add New Task Form */}
          <div className="bg-white p-6 rounded-lg shadow mb-8 max-w-4xl">
            <h2 className="text-xl text-gray-600 mb-4">Add New Task</h2>
            <form onSubmit={addTask} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-violet-500 focus:border-violet-500 text-gray-600"
                  required
                />
              </div>
              <div>
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-400 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-violet-400 text-white rounded-md  focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  Add Task
                </button>
              </div>
              <div className="md:col-span-4">
                <textarea
                  placeholder="Task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-violet-500 focus:border-violet-500 text-gray-600"
                  rows={2}
                />
              </div>
            </form>
          </div>

          {/* Kanban Board */}
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Pending Column */}
              <DroppableColumn 
                status="pending" 
                title="Pending" 
                emoji="" 
                tasks={pendingTasks}
              >
                <SortableContext
                  items={pendingTasks.map(task => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {pendingTasks.map((task) => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      onEdit={setEditingTask}
                      onDelete={deleteTask}
                      isEditing={editingTask?.id === task.id}
                      editingTask={editingTask}
                      onUpdate={updateTask}
                      onCancelEdit={() => setEditingTask(null)}
                      setEditingTask={setEditingTask}
                    />
                  ))}
                  {pendingTasks.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No pending tasks</p>
                  )}
                </SortableContext>
              </DroppableColumn>

              {/* In Progress Column */}
              <DroppableColumn 
                status="in-progress" 
                title="In Progress" 
                emoji="" 
                tasks={inProgressTasks}
              >
                <SortableContext
                  items={inProgressTasks.map(task => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {inProgressTasks.map((task) => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      onEdit={setEditingTask}
                      onDelete={deleteTask}
                      isEditing={editingTask?.id === task.id}
                      editingTask={editingTask}
                      onUpdate={updateTask}
                      onCancelEdit={() => setEditingTask(null)}
                      setEditingTask={setEditingTask}
                    />
                  ))}
                  {inProgressTasks.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No tasks in progress</p>
                  )}
                </SortableContext>
              </DroppableColumn>

              {/* Completed Column */}
              <DroppableColumn 
                status="completed" 
                title="Completed" 
                emoji="" 
                tasks={completedTasks}
              >
                <SortableContext
                  items={completedTasks.map(task => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {completedTasks.map((task) => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      onEdit={setEditingTask}
                      onDelete={deleteTask}
                      isEditing={editingTask?.id === task.id}
                      editingTask={editingTask}
                      onUpdate={updateTask}
                      onCancelEdit={() => setEditingTask(null)}
                      setEditingTask={setEditingTask}
                    />
                  ))}
                  {completedTasks.length === 0 && (
                    <p className="text-gray-400 text-center py-8">No completed tasks</p>
                  )}
                </SortableContext>
              </DroppableColumn>
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="bg-white p-4 rounded-lg shadow-lg border-2 border-blue-400 opacity-90 rotate-3">
                  <h3 className="text-sm font-semibold text-gray-800">{activeTask.title}</h3>
                  {activeTask.description && (
                    <p className="text-xs text-gray-600 mt-1">{activeTask.description}</p>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  )
}