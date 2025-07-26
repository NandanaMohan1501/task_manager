import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const useRealTimeTasks = (userId: string, setTasks: any) => {
  useEffect(() => {
    const channel = supabase
      .channel('tasks_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        }, 
        (payload) => {
          console.log('Real-time update:', payload)
          
          if (payload.eventType === 'INSERT') {
            setTasks((prev: any) => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev: any) => 
              prev.map((task: any) => 
                task.id === payload.new.id ? payload.new : task
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev: any) => 
              prev.filter((task: any) => task.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, setTasks])
}