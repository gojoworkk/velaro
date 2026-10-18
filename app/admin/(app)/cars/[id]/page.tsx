import Link from 'next/link';
import { getCar } from '@/lib/admin/fleet';
import { requireUser } from '@/lib/auth/current';
import { getDb } from '@/lib/db';
import { updateCarAction } from '../../../actions';
import { CarForm } from '../car-form';

export default async function EditCarPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const car = await getCar(getDb(), decodeURIComponent((await params).id));
  if (!car) {
    return (
      <div className="a-empty">
        <h1 className="a-title">Машина не найдена</h1>
        <Link href="/admin/cars" className="a-btn a-btn--primary">К автопарку</Link>
      </div>
    );
  }
  return (
    <>
      <Link href="/admin/cars" className="a-back">← Автопарк</Link>
      <h1 className="a-title">{car.name}</h1>
      <CarForm action={updateCarAction.bind(null, car.id)} car={car} />
    </>
  );
}
