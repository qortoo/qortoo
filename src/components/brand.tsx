import site from '../../site.config.json';

export function Brand() {
  return <span className="brand">
    <img className="brand-emblem" src={`${site.basePath}/brand/emblem.png`} width={36} height={36} alt="" />
    <span>qortoo</span>
  </span>;
}
