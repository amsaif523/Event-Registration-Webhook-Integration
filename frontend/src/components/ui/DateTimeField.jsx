import { createTheme, ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';

/**
 * Date and time entry, MUI X's DateTimePicker.
 *
 * It is responsive by design: a popper with a calendar and clock on desktop, a
 * full-screen modal with larger touch targets on mobile — which is why it earns
 * its weight over the native `datetime-local` input, whose mobile UI we cannot
 * style and whose desktop UI differs per browser.
 *
 * MUI ships its own design system, so the theme below overrides it back onto
 * our tokens: brand cyan, Inter, 8px radii, hairline borders, and the same
 * focus ring every other control uses. The module is loaded lazily by
 * EventSlideOver so none of this reaches the public bundle.
 */

const INK = '#0B1220';
const BODY = '#475569';
const META = '#94A3B8';
const HAIRLINE = '#E2E8F0';
const BRAND = '#0FB5C9';

const theme = createTheme({
  palette: {
    primary: { main: BRAND, contrastText: '#FFFFFF' },
    text: { primary: INK, secondary: BODY, disabled: META },
    divider: HAIRLINE,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontSize: 15,
  },
  components: {
    /**
     * Sized to our TextInput exactly: 44px tall (h-11), 12px horizontal
     * padding, 16px text on mobile so iOS does not zoom on focus and 15px from
     * `sm` up. MUI's own metrics are taller and its font scale is its own, so
     * every one of these is a deliberate override rather than a default.
     */
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          height: 44,
          minHeight: 44,
          boxSizing: 'border-box',
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          color: INK,
          paddingRight: 6,
          transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: HAIRLINE, top: 0 },
          '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: BRAND, borderWidth: 1 },
          '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(15, 181, 201, 0.25)' },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#F87171' },
          '&.Mui-error.Mui-focused': { boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.2)' },
          '&.Mui-disabled': { backgroundColor: '#F8FAFC' },
        },
        input: {
          height: 42,
          padding: '0 12px',
          fontSize: 16,
          lineHeight: '42px',
          '@media (min-width: 640px)': { fontSize: 15 },
          '&::placeholder': { color: META, opacity: 1 },
        },
      },
    },
    MuiInputAdornment: { styleOverrides: { root: { marginLeft: 0 } } },
    // The default 40px button inflates the row and dwarfs our 16-18px icons.
    MuiIconButton: {
      styleOverrides: {
        root: {
          width: 32,
          height: 32,
          padding: 0,
          color: META,
          '& .MuiSvgIcon-root': { fontSize: 18 },
          '&:hover': { backgroundColor: '#F1F5F9', color: INK },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${HAIRLINE}`,
          boxShadow:
            '0 2px 4px rgba(11, 18, 32, 0.05), 0 16px 32px -16px rgba(11, 18, 32, 0.16)',
        },
      },
    },
    MuiPickersDay: {
      styleOverrides: {
        root: {
          fontSize: 13,
          color: BODY,
          '&:hover': { backgroundColor: '#ECFDFF' },
          '&.Mui-selected': { backgroundColor: BRAND, color: '#FFFFFF' },
          '&.Mui-selected:hover, &.Mui-selected:focus': { backgroundColor: '#0C93A5' },
          '&.MuiPickersDay-today': { borderColor: BRAND },
        },
      },
    },
    MuiMultiSectionDigitalClockSection: {
      styleOverrides: {
        item: {
          fontSize: 13,
          '&:hover': { backgroundColor: '#ECFDFF' },
          '&.Mui-selected': { backgroundColor: BRAND, color: '#FFFFFF' },
          '&.Mui-selected:hover': { backgroundColor: '#0C93A5' },
        },
      },
    },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } } },
  },
});

// The form keeps dates as the MySQL-ish string it will send, not as objects.
const FORMAT = 'YYYY-MM-DDTHH:mm';

export default function DateTimeField({ id, value, onChange, error, disabled = false, minDateTime }) {
  const parsed = value ? dayjs(value) : null;

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateTimePicker
          value={parsed && parsed.isValid() ? parsed : null}
          onChange={(next) => onChange(next && next.isValid() ? next.format(FORMAT) : '')}
          disabled={disabled}
          minDateTime={minDateTime ? dayjs(minDateTime) : undefined}
          format="DD MMM YYYY, hh:mm A"
          slotProps={{
            textField: {
              id,
              fullWidth: true,
              error: Boolean(error),
              // Our <Field> already renders the label and the error message.
              label: undefined,
              placeholder: 'Select date and time',
              'aria-invalid': error ? 'true' : undefined,
            },
            // Sit above the slide-over, which owns z-50.
            popper: { sx: { zIndex: 80 } },
            dialog: { sx: { zIndex: 80 } },
          }}
        />
      </LocalizationProvider>
    </ThemeProvider>
  );
}
