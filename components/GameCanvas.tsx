'use client'

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

export interface GameCanvasHandle {
  applyStroke: (type: 'start' | 'move' | 'end', xn: number, yn: number) => void
  clearCanvas: () => void
}

interface GameCanvasProps {
  isActive: boolean
  onStroke?: (type: 'start' | 'move' | 'end', xn: number, yn: number) => void
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({ isActive, onStroke }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth * 2
    canvas.height = canvas.offsetHeight * 2
    canvas.style.width = `${canvas.offsetWidth / 2 * 2}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(2, 2)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    contextRef.current = ctx

    // Prevent page scroll on touch — passive:false lets preventDefault() work
    const block = (e: TouchEvent) => e.preventDefault()
    canvas.addEventListener('touchstart', block, { passive: false })
    canvas.addEventListener('touchmove',  block, { passive: false })
    return () => {
      canvas.removeEventListener('touchstart', block)
      canvas.removeEventListener('touchmove',  block)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    applyStroke(type, xn, yn) {
      const canvas = canvasRef.current
      const ctx = contextRef.current
      if (!canvas || !ctx) return
      const x = xn * canvas.offsetWidth
      const y = yn * canvas.offsetHeight
      if (type === 'start') {
        ctx.beginPath()
        ctx.moveTo(x, y)
      } else if (type === 'move') {
        ctx.lineTo(x, y)
        ctx.stroke()
      } else {
        ctx.closePath()
      }
    },
    clearCanvas() {
      const canvas = canvasRef.current
      const ctx = contextRef.current
      if (!canvas || !ctx) return
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    },
  }))

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { xn: 0, yn: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e.nativeEvent) {
      const touch = (e.nativeEvent as TouchEvent).touches[0]
        || (e.nativeEvent as TouchEvent).changedTouches[0]
      return {
        xn: (touch.clientX - rect.left) / rect.width,
        yn: (touch.clientY - rect.top) / rect.height,
      }
    }
    const me = e.nativeEvent as MouseEvent
    return {
      xn: (me.clientX - rect.left) / rect.width,
      yn: (me.clientY - rect.top) / rect.height,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isActive) return
    e.preventDefault()
    const { xn, yn } = getCoords(e)
    const ctx = contextRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.beginPath()
    ctx.moveTo(xn * canvas.offsetWidth, yn * canvas.offsetHeight)
    isDrawingRef.current = true
    onStroke?.('start', xn, yn)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    e.preventDefault()
    const { xn, yn } = getCoords(e)
    const ctx = contextRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.lineTo(xn * canvas.offsetWidth, yn * canvas.offsetHeight)
    ctx.stroke()
    onStroke?.('move', xn, yn)
  }

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    contextRef.current?.closePath()
    isDrawingRef.current = false
    const { xn, yn } = getCoords(e)
    onStroke?.('end', xn, yn)
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      style={{ touchAction: 'none' }}
      className={`w-full bg-white border-2 border-gray-200 rounded-2xl aspect-square ${
        isActive ? 'cursor-crosshair' : 'cursor-default opacity-90'
      }`}
    />
  )
})

GameCanvas.displayName = 'GameCanvas'
export default GameCanvas
