import { useState, useCallback } from 'react'

interface LoadingState {
  isLoading: boolean
  message: string
  subMessage: string | undefined
}

interface UseLoadingOverlayReturn {
  isLoading: boolean
  loadingMessage: string
  loadingSubMessage: string | undefined
  setLoading: (message?: string, subMessage?: string) => void
  clearLoading: () => void
}

export function useLoadingOverlay(): UseLoadingOverlayReturn {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    message: 'Loading…',
    subMessage: undefined,
  })

  const setLoading = useCallback(
    (message: string = 'Loading…', subMessage?: string) => {
      setState({ isLoading: true, message, subMessage })
    },
    []
  )

  const clearLoading = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [])

  return {
    isLoading: state.isLoading,
    loadingMessage: state.message,
    loadingSubMessage: state.subMessage,
    setLoading,
    clearLoading,
  }
}
