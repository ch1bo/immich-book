import { useState } from 'react'
import { init, getAllAlbums } from '@immich/sdk'

export interface ImmichConfig {
  serverUrl: string
  apiKey: string
  baseUrl: string
}

interface ConnectionFormProps {
  onConnect: (config: ImmichConfig) => void
}

function ConnectionForm({ onConnect }: ConnectionFormProps) {
    const [serverUrl, setServerUrl] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsConnecting(true)

        try {
            // In development, use proxy path. In production, use full URL
            const isDev = import.meta.env.DEV
            const baseUrl = isDev ? '/api' : serverUrl.replace(/\/$/, '') + '/api'

            // Initialize the SDK
            init({ baseUrl, apiKey })

            // Validate connection by getting albums
            await getAllAlbums({})

            // Store config in state and localStorage
            const config: ImmichConfig = { serverUrl, apiKey, baseUrl }
            localStorage.setItem('immich-config', JSON.stringify(config))
            onConnect(config)
        } catch (err) {
            setError((err as Error).message || 'Failed to connect to Immich server')
            setIsConnecting(false)
        }
    }

    return (
        <div className="max-w-md mx-auto">
            <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Connect to Immich</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Enter your Immich server URL and API key to get started.
                </p>
                {import.meta.env.DEV && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-xs text-blue-800">
                            <strong>Dev Mode:</strong> Using proxy to {import.meta.env.VITE_IMMICH_PROXY_TARGET || 'localhost:3000'}
                        </p>
                    </div>
                )}

                {!import.meta.env.DEV && typeof window !== 'undefined' && !window.location.hostname.match(/^(localhost|127\.0\.0\.1|.*\.local)$/) && (
                    <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-md">
                        <p className="text-xs text-yellow-900 font-semibold mb-2">⚠️ Security Warning</p>
                        <p className="text-xs text-yellow-800">
                            You are using a third-party hosted instance. Your API key may be recorded by <strong>{window.location.hostname}</strong>.
                            Only proceed if you trust this hosting provider! Anyone who controls the hosting can potentially access all your photos through your API key.
                            For maximum security, consider self-hosting on the same domain as your Immich server.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="serverUrl" className="block text-sm font-medium text-gray-700 mb-1">
                            Server URL
                        </label>
                        <input
                            type="url"
                            id="serverUrl"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="https://immich.example.com"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                            API Key
                        </label>
                        <input
                            type="password"
                            id="apiKey"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Your Immich API key"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Generate an API key in Immich: Account Settings → API Keys
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isConnecting}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default ConnectionForm
