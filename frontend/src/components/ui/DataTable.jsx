import RDT from 'react-data-table-component';
import Icon from '../icons/Icon.jsx';
import { TableSkeleton } from './States.jsx';

/**
 * One configured wrapper around react-data-table-component so sorting,
 * pagination and expandable rows behave identically on every admin screen and
 * the library's default chrome never leaks into our design system.
 *
 * Rendered from `sm` up only. Below that each screen swaps to its own stacked
 * cards, because a horizontally scrolling table at 390px is not a mobile
 * design, it is a desktop table someone gave up on.
 */

const INK = '#0B1220';
const BODY = '#475569';
const META = '#94A3B8';
const HAIRLINE = '#E2E8F0';

const customStyles = {
  table: { style: { backgroundColor: 'transparent' } },
  responsiveWrapper: { style: { borderRadius: '12px' } },
  head: { style: { fontFamily: 'inherit' } },
  headRow: {
    style: {
      backgroundColor: 'rgba(248, 250, 252, 0.7)',
      borderBottomColor: HAIRLINE,
      minHeight: '44px',
    },
  },
  headCells: {
    style: {
      paddingLeft: '20px',
      paddingRight: '20px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: META,
    },
  },
  rows: {
    style: {
      minHeight: '60px',
      fontSize: '14px',
      color: BODY,
      borderBottomColor: `${HAIRLINE} !important`,
      transition: 'background-color 150ms ease-out',
      '&:last-of-type': { borderBottom: 'none' },
    },
    highlightOnHoverStyle: {
      backgroundColor: '#F8FAFC',
      borderBottomColor: HAIRLINE,
      outline: 'none',
    },
  },
  cells: { style: { paddingLeft: '20px', paddingRight: '20px', paddingTop: '12px', paddingBottom: '12px' } },
  expanderRow: { style: { backgroundColor: '#F8FAFC', color: BODY } },
  expanderButton: {
    style: {
      color: META,
      borderRadius: '6px',
      transition: 'background-color 150ms ease-out',
      '&:hover:not(:disabled)': { backgroundColor: '#E2E8F0', color: INK },
      '&:focus': { outline: 'none', backgroundColor: '#E2E8F0' },
      'svg': { margin: 'auto' },
    },
  },
  pagination: {
    style: {
      borderTopColor: HAIRLINE,
      color: BODY,
      fontSize: '13px',
      fontVariantNumeric: 'tabular-nums',
      minHeight: '52px',
    },
    pageButtonsStyle: {
      borderRadius: '6px',
      height: '32px',
      width: '32px',
      padding: '4px',
      margin: '0 2px',
      cursor: 'pointer',
      transition: 'background-color 150ms ease-out',
      color: BODY,
      fill: BODY,
      '&:disabled': { cursor: 'not-allowed', color: '#CBD5E1', fill: '#CBD5E1' },
      '&:hover:not(:disabled)': { backgroundColor: '#F1F5F9' },
      '&:focus': { outline: 'none', backgroundColor: '#E2E8F0' },
    },
  },
  noData: { style: { backgroundColor: 'transparent' } },
  progress: { style: { backgroundColor: 'transparent', padding: 0 } },
};

const sortIcon = <Icon name="chevronDown" size={14} className="ml-1" />;

const paginationOptions = {
  rowsPerPageText: 'Rows per page',
  rangeSeparatorText: 'of',
  noRowsPerPage: false,
  selectAllRowsItem: false,
};

export default function DataTable({
  columns,
  data,
  loading = false,
  emptyState,
  skeletonColumns = 5,
  perPage = 10,
  footer,
  className = '',
  ...rest
}) {
  return (
    <div className={`hidden overflow-hidden rounded-card border border-hairline bg-white sm:block ${className}`}>
      <RDT
        columns={columns}
        data={data}
        customStyles={customStyles}
        sortIcon={sortIcon}
        pagination={data.length > perPage}
        paginationPerPage={perPage}
        paginationRowsPerPageOptions={[10, 25, 50, 100]}
        paginationComponentOptions={paginationOptions}
        progressPending={loading}
        progressComponent={<TableSkeleton rows={6} columns={skeletonColumns} />}
        noDataComponent={emptyState ?? null}
        persistTableHead
        highlightOnHover
        {...rest}
      />
      {footer}
    </div>
  );
}
