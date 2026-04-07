import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  isFormData?: boolean
}

/**
 * Authenticated fetch to the FastAPI backend.
 * Throws on non-2xx responses with the error detail.
 */
export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, isFormData = false } = opts

  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  if (!isFormData && body) headers['Content-Type'] = 'application/json'

  const resp = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail || `Erreur ${resp.status}`)
  }

  return resp.json()
}

/**
 * Download a file from the backend (returns a Blob).
 * Used for document generation endpoints that return FileResponse.
 */
export async function apiDownload(path: string, opts: ApiOptions = {}): Promise<{ blob: Blob; filename: string }> {
  const { method = 'POST', body, isFormData = false } = opts

  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {}
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  if (!isFormData && body) headers['Content-Type'] = 'application/json'

  const resp = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail || `Erreur ${resp.status}`)
  }

  // Extract filename from Content-Disposition header
  const cd = resp.headers.get('content-disposition') || ''
  const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/)
  const filename = match ? decodeURIComponent(match[1]) : 'download.bin'

  const blob = await resp.blob()
  return { blob, filename }
}

/**
 * Triggers a browser download for a Blob.
 */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
