/**
 * Data Table Editor: CSV và JSON hiển thị dạng bảng tương tác.
 * Sort, filter, edit inline, thêm/xóa dòng, xuất file.
 */
import { useState, useEffect, useMemo } from 'react';
import { useCsvWorker } from '../../hooks/useWorker';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { ArrowUpDown, Plus, Trash2, Download, Search, Table2 } from 'lucide-react';

export default function DataTableEditor({ content, contentType = 'csv', onChange }) {
  const csvWorker = useCsvWorker();
  const [rows,    setRows]    = useState([]);
  const [headers, setHeaders] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [filter,  setFilter]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Parse content khi props thay đổi
  useEffect(() => {
    if (!content?.trim()) {
      setHeaders(['id', 'name', 'value']);
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);

    const parse = async () => {
      try {
        if (contentType === 'csv') {
          const { header, rows: r } = await csvWorker.parse(content);
          setHeaders(header && header.length > 0 ? header : ['Col1', 'Col2', 'Col3']);
          setRows(r || []);
        } else if (contentType === 'json') {
          const data = JSON.parse(content);
          if (Array.isArray(data) && data.length > 0) {
            const h = Object.keys(data[0]);
            setHeaders(h);
            setRows(data);
          } else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data);
            setHeaders(['key', 'value']);
            setRows(keys.map(k => ({ key: k, value: typeof data[k] === 'object' ? JSON.stringify(data[k]) : String(data[k]) })));
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    parse();
  }, [content, contentType]);

  // Convert rows back to CSV/JSON khi thay đổi
  const emitChange = (newRows, newHeaders) => {
    const h = newHeaders || headers;
    const r = newRows   || rows;
    if (contentType === 'csv') {
      const csv = [
        h.join(','),
        ...r.map(row => h.map(col => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      onChange?.(csv);
    } else {
      onChange?.(JSON.stringify(r, null, 2));
    }
  };

  const columns = useMemo(() => headers.map(h => ({
    accessorKey: h,
    header: ({ column }) => (
      <div
        className="flex items-center gap-1.5 cursor-pointer select-none text-gray-300 hover:text-amber-300 font-semibold"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>{h}</span>
        <ArrowUpDown size={12} className="text-gray-500 hover:text-amber-300" />
      </div>
    ),
    cell: ({ getValue, row, column }) => {
      const initialVal = getValue();
      return (
        <input
          defaultValue={initialVal ?? ''}
          onBlur={e => {
            const val = e.target.value;
            if (val !== initialVal) {
              const newRows = [...rows];
              newRows[row.index] = { ...newRows[row.index], [column.id]: val };
              setRows(newRows);
              emitChange(newRows);
            }
          }}
          className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-amber-400/50 focus:bg-amber-500/10 rounded px-1.5 py-1 text-xs text-gray-100 outline-none transition-colors"
        />
      );
    },
  })), [headers, rows]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const addRow = () => {
    const newRow = headers.reduce((obj, h) => { obj[h] = ''; return obj; }, {});
    const newRows = [...rows, newRow];
    setRows(newRows);
    emitChange(newRows);
  };

  const deleteRow = (idx) => {
    const newRows = rows.filter((_, i) => i !== idx);
    setRows(newRows);
    emitChange(newRows);
  };

  const downloadFile = () => {
    let blob, filename;
    if (contentType === 'csv') {
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
      blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      filename = 'table-data.csv';
    } else {
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      filename = 'table-data.json';
    }
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <span className="text-xs font-mono">Đang đọc và phân tích cấu trúc bảng...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400 text-sm bg-red-950/20 border border-red-500/20 rounded-xl m-4">
        <p className="font-semibold mb-1">Lỗi phân tích dữ liệu bảng:</p>
        <p className="font-mono text-xs text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#121218] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-[#1a1a24] border-b border-white/10 flex-shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Lọc dữ liệu trong toàn bộ bảng..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 px-2 py-1 rounded bg-white/5 border border-white/10 font-mono">
            {table.getFilteredRowModel().rows.length} / {rows.length} hàng
          </span>

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 rounded-lg font-medium transition-all"
          >
            <Plus size={13} />
            <span>Thêm hàng</span>
          </button>

          <button
            onClick={downloadFile}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-200 rounded-lg border border-white/10 font-medium transition-all"
          >
            <Download size={13} />
            <span>{contentType.toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Interactive Table Container */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
            <Table2 size={36} className="text-gray-600" />
            <p className="text-xs">Chưa có dòng dữ liệu nào. Nhấn "Thêm hàng" để bắt đầu.</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse font-sans">
            <thead className="sticky top-0 bg-[#161620] border-b border-white/10 z-10">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  <th className="w-12 px-3 py-2.5 text-left text-gray-500 font-mono border-r border-white/5">#</th>
                  {hg.headers.map(h => (
                    <th key={h.id} className="px-3 py-2.5 text-left border-r border-white/5">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                  <th className="w-12 px-2" />
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, visIdx) => (
                <tr
                  key={row.id}
                  className="border-b border-white/5 hover:bg-white/[0.03] transition-colors group"
                >
                  <td className="px-3 py-1 text-gray-500 font-mono text-[11px] border-r border-white/5 select-none">
                    {visIdx + 1}
                  </td>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="p-0.5 border-r border-white/5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-2 text-center">
                    <button
                      onClick={() => deleteRow(row.index)}
                      title="Xóa hàng này"
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
