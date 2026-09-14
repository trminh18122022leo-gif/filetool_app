import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function ToolCard({
  title,
  description,
  icon: Icon,
  to,
  badge = null,
  gradient = 'hover:border-amber-400/40 hover:shadow-[0_15px_35px_rgba(245,158,11,0.15)]',
  iconColor = 'text-amber-400 bg-amber-500/10 border-amber-400/20',
}) {
  return (
    <Link
      to={to}
      className={`liquid-glass-card specular-sheen p-6 flex flex-col justify-between group transition-all duration-300 ${gradient}`}
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3.5 rounded-2xl border ${iconColor} transition-transform group-hover:scale-110 duration-300`}>
            {Icon && <Icon size={24} />}
          </div>
          {badge && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
              {badge}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors flex items-center justify-between">
          <span>{title}</span>
          <ChevronRight size={18} className="text-gray-500 group-hover:text-amber-300 group-hover:translate-x-1 transition-all" />
        </h3>
        <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}
