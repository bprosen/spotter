/** A form block: title and help on the left, fields on the right (stacked on small screens). */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t pt-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  );
}
