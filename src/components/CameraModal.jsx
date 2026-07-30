import { useState, useEffect, useRef } from 'react'
import { Modal, Btn } from './shared/index'
import toast from 'react-hot-toast'

export default function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('user') // 'user' or 'environment'
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [loading, setLoading] = useState(true)

  // Enumerate video devices to check if there are multiple cameras
  useEffect(() => {
    if (!open) return
    navigator.mediaDevices?.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      })
      .catch(() => {})
  }, [open])

  // Initialize and update camera stream
  useEffect(() => {
    if (!open) return

    let active = true
    setLoading(true)
    setCameraError(null)

    // Stop current stream before opening new one
    stopCamera()

    navigator.mediaDevices?.getUserMedia({
      video: {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    })
      .then(stream => {
        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(err => {
            console.error('Error playing video stream:', err)
          })
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error accessing camera:', err)
        if (active) {
          setCameraError('Camera access denied or unavailable. Please check permissions.')
          setLoading(false)
        }
      })

    return () => {
      active = false
      stopCamera()
    }
  }, [open, facingMode])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const handleCapture = () => {
    const video = videoRef.current
    if (!video || loading || cameraError) return

    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')

      if (facingMode === 'user') {
        // Mirror the canvas image to match user preview
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)

      // Clean up and call callback
      stopCamera()
      onCapture(dataUrl)
      onClose()
    } catch (err) {
      console.error('Capture failed:', err)
      toast.error('Failed to capture photo')
    }
  }

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'))
  }

  return (
    <Modal open={open} onClose={onClose} title="📷 Take Profile Photo" width={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        
        {/* Video stream container */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          background: '#111320',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1.5px solid var(--border)',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {loading && (
            <div style={{ color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, border: '3px solid #333', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Accessing camera...</span>
            </div>
          )}

          {cameraError && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{cameraError}</span>
            </div>
          )}

          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              display: (loading || cameraError) ? 'none' : 'block'
            }}
          />

          {/* Pulse indicator for live mode */}
          {!loading && !cameraError && (
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(0,0,0,0.6)',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              color: '#00ff88',
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#00ff88',
                boxShadow: '0 0 8px #00ff88',
                animation: 'pulse 1.5s infinite'
              }} />
              Live
            </div>
          )}
        </div>

        {/* Buttons / Controls */}
        <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'center' }}>
          {!cameraError && (
            <Btn variant="primary" onClick={handleCapture} disabled={loading} style={{ flex: 1, padding: '12px 24px' }}>
              📸 Capture Photo
            </Btn>
          )}

          {hasMultipleCameras && !cameraError && (
            <Btn variant="ghost" onClick={toggleCamera} disabled={loading} style={{ padding: '12px' }} title="Switch Camera">
              🔄 Switch Camera
            </Btn>
          )}
        </div>

        {cameraError && (
          <Btn variant="ghost" onClick={onClose} full>
            Close
          </Btn>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </Modal>
  )
}
