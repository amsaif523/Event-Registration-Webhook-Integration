import { useNavigation } from '../state/NavigationContext.jsx';
import Button from '../components/ui/Button.jsx';
import Icon from '../components/icons/Icon.jsx';

export default function NotFoundPage() {
  const { backToEvents } = useNavigation();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-20 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-hairline bg-white text-brand-500">
        <Icon name="compass" size={26} />
      </div>
      <p className="tabular mt-6 font-mono text-sm text-meta">404</p>
      <h1 className="mt-2 font-display text-display-sm font-bold text-ink">We can&rsquo;t find that page</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-body">
        The screen you were looking for does not exist. Everything in Eventide is reachable from the events list.
      </p>
      <Button className="mt-7" size="lg" icon="arrowLeft" onClick={backToEvents}>
        Back to events
      </Button>
    </div>
  );
}
