import { listUsers } from '@/lib/admin/users';
import { requireUser } from '@/lib/auth/current';
import { getDb } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { ActionForm } from '../../_components/action-form';
import { resetPasswordAction, setActiveAction } from '../../actions';
import { ManagerForm } from './manager-form';

export default async function ManagersPage() {
  await requireUser('owner');
  const people = await listUsers(getDb());
  return (
    <>
      <h1 className="a-title">Менеджеры</h1>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Последний вход</th><th>Пароль</th><th>Доступ</th></tr>
          </thead>
          <tbody>
            {people.map((u) => (
              <tr key={u.id} className={u.active ? undefined : 'a-table__off'}>
                <td><b>{u.name}</b></td>
                <td>{u.login}</td>
                <td><span className={`a-badge${u.role === 'owner' ? '' : ' a-badge--soft'}`}>{u.role === 'owner' ? 'Владелец' : 'Менеджер'}</span></td>
                <td className="a-row__muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Не входил(а)'}</td>
                <td>
                  {u.role === 'manager' && (
                    <ActionForm action={resetPasswordAction.bind(null, u.id)} className="a-inline" success="Пароль сброшен.">
                      <input name="password" required minLength={8} placeholder="Новый пароль" aria-label={`Новый пароль для ${u.name}`} autoComplete="new-password" />
                      <button className="a-btn a-btn--outline">Сбросить</button>
                    </ActionForm>
                  )}
                </td>
                <td>
                  {u.role === 'manager' && (
                    <ActionForm action={setActiveAction.bind(null, u.id, !u.active)}>
                      <button className={`a-btn ${u.active ? 'a-btn--danger' : 'a-btn--outline'}`}>{u.active ? 'Отключить' : 'Включить'}</button>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="a-section">
        <h2 className="a-subtitle">Добавить менеджера</h2>
        <ManagerForm />
      </section>
    </>
  );
}
