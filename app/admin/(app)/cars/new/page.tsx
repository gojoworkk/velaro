import Link from 'next/link';
import { requireUser } from '@/lib/auth/current';
import { createCarAction } from '../../../actions';
import { CarForm } from '../car-form';

export default async function NewCarPage() {
  await requireUser();
  return (
    <>
      <Link href="/admin/cars" className="a-back">← Автопарк</Link>
      <h1 className="a-title">Новая машина</h1>
      <CarForm action={createCarAction} />
    </>
  );
}
