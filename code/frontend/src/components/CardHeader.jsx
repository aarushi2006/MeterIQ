export default function CardHeader({ title, text, right }) {
  return (
    <header className="head">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <span>{right}</span>
    </header>
  );
}
