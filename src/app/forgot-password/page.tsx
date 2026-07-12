'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSent(true)
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <div className="auth-logo-icon">A</div>
            <span className="auth-logo-text">AssetFlow</span>
          </div>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>📧</div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">
            We&apos;ve sent a password reset link to <strong>{email}</strong>.
            <br />Check your inbox and follow the instructions.
          </p>
          <Link href="/login" className="btn btn-secondary" style={{ marginTop: 'var(--space-lg)' }}>
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">A</div>
          <span className="auth-logo-text">AssetFlow</span>
        </div>

        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">Enter your email and we&apos;ll send you reset instructions</p>

        {error && (
          <div className="alert-banner alert-error">
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleReset}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: 'var(--space-sm)' }}
          >
            {loading ? (
              <>
                <span className="spinner" /> Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <p className="text-sm text-secondary" style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
          Remember your password?{' '}
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
