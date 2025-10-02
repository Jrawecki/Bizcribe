import BusinessCard from './BusinessCard.jsx';

export default function BusinessList({ items, onDelete, manageableIds }) {
  if (!items.length) {
    return <p className="text-white/70 text-center mt-6">No businesses match your search.</p>;
  }
  return (
    <div className="max-w-7xl mx-auto w-full px-4 pb-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {items.map((biz) => (
        <BusinessCard
          key={biz.id}
          biz={biz}
          onDelete={onDelete}
          canManage={manageableIds?.has?.(biz.id) ?? false}
        />
      ))}
    </div>
  );
}
