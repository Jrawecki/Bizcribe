export default function About() {
  const pillars = [
    {
      title: 'For locals',
      points: [
        'Discover nearby shops, services, and experiences on an interactive map.',
        'Save time by seeing essentials at a glance: hours, contact info, and directions.',
        'Support the places that make your neighborhood unique.',
      ],
    },
    {
      title: 'For business owners',
      points: [
        'Create a profile that highlights what makes you stand out.',
        'Reach people who are actively looking for local spots.',
        'Keep details up to date so customers can find you fast.',
      ],
    },
  ];

  const steps = [
    'Search or browse your area on the map.',
    'Tap a business to see key details and get directions.',
    'Follow updates as more local spots join the community.',
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-12">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-white/50">About Bizcribe</p>
        <h1 className="text-4xl font-semibold leading-tight text-[var(--ceramic,white)]">
          Bizcribe is built to help people discover the small businesses that shape their communities.
        </h1>
        <p className="text-lg text-white/80 leading-relaxed max-w-3xl">
          Through an interactive map, you can explore local shops, services, and unique experiences around you-making it easier
          than ever to support the businesses in your own neighborhood. For owners, Bizcribe is a simple way to increase
          visibility and connect with nearby customers by sharing what makes you stand out.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {pillars.map((pillar) => (
          <div key={pillar.title} className="rounded-2xl bg-white/5 border border-white/10 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-[var(--ceramic,white)] mb-3">{pillar.title}</h2>
            <ul className="space-y-2 text-white/80 leading-relaxed list-disc list-inside">
              {pillar.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white/5 border border-white/10 p-6 shadow-lg space-y-4">
        <h2 className="text-xl font-semibold text-[var(--ceramic,white)]">Our mission</h2>
        <p className="text-white/80 leading-relaxed">
          We aim to bridge the gap between local businesses and the communities they serve. By making discovery effortless and
          empowering entrepreneurs with modern digital tools, we want to strengthen local economies-one business at a time.
        </p>
      </section>

      <section className="rounded-2xl bg-white/5 border border-white/10 p-6 shadow-lg space-y-4">
        <h2 className="text-xl font-semibold text-[var(--ceramic,white)]">How it works</h2>
        <ol className="space-y-3 text-white/80 leading-relaxed list-decimal list-inside">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-white/5 border border-white/10 p-6 shadow-lg flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--ceramic,white)]">Ready to get featured?</h2>
          <p className="text-white/80 leading-relaxed">
            Share your story and help locals discover what makes your spot special.
          </p>
        </div>
        <a
          href="/register-business"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--ceramic,#5d85ff)] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110"
        >
          Add your business
        </a>
      </section>
    </div>
  );
}
