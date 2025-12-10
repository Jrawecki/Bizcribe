import { Phone, MapPin, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BusinessCard({ biz, onDelete, canManage }) {
  return (
    <div className="card p-6 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-2">
        <Link to={`/business/${biz.id}`} className="underline decoration-transparent hover:decoration-inherit">
          {biz.name}
        </Link>
      </h2>
      <p className="mb-4 opacity-95">{biz.description}</p>
      <div className="flex items-center gap-2 text-sm mb-2 opacity-95">
        <span className="chip inline-flex items-center justify-center w-6 h-6">
          <Phone size={14} />
        </span>
        {biz.phone_number}
      </div>
      <div className="flex items-center gap-2 text-sm opacity-95">
        <span className="chip inline-flex items-center justify-center w-6 h-6">
          <MapPin size={14} />
        </span>
        {biz.hide_address ? 'Address hidden' : biz.location}
      </div>
      {canManage && (
        <button
          onClick={() => onDelete(biz.id)}
          className="mt-4 text-red-200 hover:text-red-100 transition"
          title="Delete"
        >
          <Trash2 />
        </button>
      )}
    </div>
  );
}
