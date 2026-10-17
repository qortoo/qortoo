// rustdoc leaves unresolved dependency comment links in copied blanket implementations.
// Repair only known links; the export checker rejects any remaining missing local target.
export function dependencyLinks(lockfile) {
  const version = (name) => {
    const block = lockfile.split('[[package]]').find((part) => part.includes(`name = "${name}"\n`));
    if (!block) throw new Error(`Missing dependency in Cargo.lock: ${name}`);
    return block.match(/version = "([^"]+)"/)[1];
  };
  const tracing = `https://docs.rs/tracing/${version('tracing')}/tracing`;
  const core = `https://docs.rs/tracing-core/${version('tracing-core')}/tracing_core`;
  const subscriber = `https://docs.rs/tracing-subscriber/${version('tracing-subscriber')}/tracing_subscriber`;
  const otel = `https://docs.rs/opentelemetry/${version('opentelemetry')}/opentelemetry`;
  return new Map([
    ['Context', `${otel}/context/struct.Context.html`],
    ['dispatcher#setting-the-default-subscriber', `${tracing}/dispatcher/index.html#setting-the-default-subscriber`],
    ['super::Subscriber', `${tracing}/trait.Subscriber.html`],
    ['super::Span::current()', `${tracing}/struct.Span.html#method.current`],
    ['crate::Span', `${tracing}/struct.Span.html`],
    ['crate::filter::Filtered', `${subscriber}/filter/struct.Filtered.html`],
    ['Self::on_event', `${subscriber}/layer/trait.Layer.html#method.on_event`],
    ['tracing_core::Subscriber', `${core}/trait.Subscriber.html`],
    ['tracing_core::Subscriber::enabled()', `${core}/trait.Subscriber.html#tymethod.enabled`],
    ['tracing_core::Subscriber::register_callsite()', `${core}/trait.Subscriber.html#method.register_callsite`],
  ]);
}
