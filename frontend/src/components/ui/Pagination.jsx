import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';
import SelectMenu from './SelectMenu.jsx';

/**
 * Pagination controls. State lives in useListQuery, which sends page and
 * per_page to the server with the rest of the query — this component only
 * renders what it is given and reports clicks back.
 *
 * "Show all" is a real option rather than a very large page size: on a phone,
 * scrolling a short list is often faster than paging through it, and the choice
 * belongs to whoever is holding the phone.
 */

const PER_PAGE_OPTIONS = [
  { value: '10', label: '10 per page' },
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: 'all', label: 'Show all' },
];

export default function Pagination({
  page,
  setPage,
  perPage,
  setPerPage,
  totalPages,
  from,
  to,
  total,
  className = '',
  label = 'items',
}) {
  if (total === 0) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className={cn('border-t border-hairline px-4 py-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="tabular text-[13px] text-meta">
          <span className="font-medium text-body">
            {from}–{to}
          </span>{' '}
          of {total} {label}
        </p>

        <div className="w-[7.5rem] shrink-0">
          <SelectMenu
            label="Rows per page"
            value={perPage}
            onChange={setPerPage}
            options={PER_PAGE_OPTIONS}
            searchPlaceholder="Search…"
            align="end"
            className="!h-9 !px-2.5 text-[13px]"
          />
        </div>
      </div>

      {perPage !== 'all' && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={!canPrev}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded border border-hairline bg-white text-[13px] font-medium text-body transition-colors duration-150 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="chevronLeft" size={15} />
            Previous
          </button>

          <span className="tabular shrink-0 px-2 text-[13px] text-meta">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={!canNext}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded border border-hairline bg-white text-[13px] font-medium text-body transition-colors duration-150 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <Icon name="chevronRight" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
