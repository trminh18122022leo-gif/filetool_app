import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function ToolCard({
  title,
  description,
  icon: Icon,
  to,
  badge = null,
  gradient = 'from-blue-900/30 to-indigo-900/10 border-blue-800/40',
  iconColor = 'text-blue-400 bg-blue-900/30',
}) {
  return (
    <Link
      to={to}
      className={`group relative p-6 rounded-2xl bg-gradient-to-br border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 ${gradient}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3.5 rounded-xl border border-white/5 ${iconColor}`}>
          {Icon && <Icon size={24} />}
        </div>
        {badge && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {badge}
          </span>
        )}
      </div>

      <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors flex items-center justify-between">
        {title}
        <ChevronRight size={18} className="text-gray-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
      </h3>
      <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
        {description}
      </p>
    </Link>
  );
}
