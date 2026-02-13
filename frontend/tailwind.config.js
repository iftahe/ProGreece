/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#3b5998',
                    700: '#2d4373',
                    800: '#1e3a5f',
                    900: '#1a2744',
                },
                sidebar: {
                    DEFAULT: '#1a1f36',
                    hover: '#252b45',
                    active: '#323a57',
                },
                income: '#10b981',
                expense: '#dc2626',
            },
            animation: {
                'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
}
