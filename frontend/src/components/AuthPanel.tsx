import type { AuthConfig } from '../lib/types';

type AuthField = keyof AuthConfig;

interface Props {
  value: AuthConfig;
  onChange: (next: AuthConfig) => void;
}

const labels: Record<AuthField, string> = {
  token: 'Bearer Token',
  userId: 'User ID',
  deviceId: 'Device ID',
  clientVersion: 'Client Version',
};

export function AuthPanel({ value, onChange }: Props) {
  const updateField = (field: AuthField, newValue: string) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-midnight-100 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-midnight-400">Connection</p>
          <h2 className="text-lg font-semibold text-midnight-900">Auth Headers</h2>
        </div>
        <span className="rounded-full bg-midnight-50 px-3 py-1 text-xs font-medium text-midnight-600">
          Required
        </span>
      </div>
      <div className="mt-4 space-y-4">
        {(Object.keys(labels) as AuthField[]).map((field) => (
          <label key={field} className="block text-sm font-medium text-midnight-700">
            {labels[field]}
            <input
              className="mt-1 w-full rounded-2xl border border-midnight-100 bg-white px-3 py-2 text-sm text-midnight-900 shadow-inner focus:border-midnight-400 focus:outline-none focus:ring-2 focus:ring-midnight-200"
              value={value[field]}
              onChange={(event) => updateField(field, event.target.value)}
              type="text"
              placeholder={labels[field]}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
