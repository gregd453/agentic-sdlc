import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="text-center py-12">
      <h2 className="text-4xl font-bold text-gray-900 mb-4">404</h2>
      <p className="text-xl text-gray-600 mb-6">Page not found</p>
      <Link
        to="/"
        className="text-primary-600 hover:text-primary-700 font-medium"
      >
        Go back to Dashboard
      </Link>
    </div>
  )
}
