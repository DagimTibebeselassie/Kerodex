import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button, Input, toast } from '@/components/ui';
import { checkUsername, currentUser, updateAccountProfile } from '@/lib/api';
import { MAKES } from '@/data/makes-models';

const vehicleTypes = ['Sedan', 'Coupe', 'SUV', 'Truck', 'EV', 'Hybrid', 'Luxury', 'Sports Car', 'Van', 'Motorcycle'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const user = currentUser();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.lastName || user?.name?.split(' ').slice(1).join(' ') || '');
  const [username, setUsername] = useState(user?.username || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>(user?.favoriteBrands || []);
  const [preferredVehicleTypes, setPreferredVehicleTypes] = useState<string[]>(user?.preferredVehicleTypes || []);
  const brandOptions = useMemo(() => MAKES.slice(0, 24), []);

  const toggle = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const next = async () => {
    setLoading(true);
    try {
      if (step === 0) {
        if (!firstName.trim() || !lastName.trim()) throw new Error('Enter your first and last name.');
        await updateAccountProfile({ firstName, lastName, name: `${firstName} ${lastName}`.trim() });
      }
      if (step === 1) {
        const result = await checkUsername(username);
        if (!result.available) throw new Error(result.error || 'That username is already taken.');
        await updateAccountProfile({ username });
      }
      if (step === 2) {
        const year = new Date(birthday).getFullYear();
        const age = new Date().getFullYear() - year;
        if (!birthday || age < 16 || age > 110) throw new Error('Enter a valid birthday.');
        await updateAccountProfile({ birthday });
      }
      if (step === 3) await updateAccountProfile({ favoriteBrands });
      if (step === 4) {
        await updateAccountProfile({ preferredVehicleTypes, onboardingCompleted: true });
        toast.success(`Welcome to Kerodex, ${firstName}.`);
        navigate({ to: '/' });
        return;
      }
      setStep((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save onboarding step.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] px-4 md:px-6 py-16 flex items-center justify-center">
      <section className="w-full max-w-xl border border-border bg-background p-6 md:p-8 animate-fade-in">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-4">Step {step + 1} of 5</p>
        {step === 0 && (
          <div className="space-y-5">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Welcome to Kerodex.</h1>
            <p className="text-[13px] text-muted-foreground">Let’s set up your profile so the marketplace feels more personal.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" />
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" />
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Choose a username.</h1>
            <p className="text-[13px] text-muted-foreground">This helps Kerodex identify your seller profile and messages.</p>
            <Input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Add your birthday.</h1>
            <p className="text-[13px] text-muted-foreground">This is stored privately and helps keep account behavior safer.</p>
            <Input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Favorite brands?</h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
              {brandOptions.map((make) => (
                <button key={make} type="button" onClick={() => toggle(make, favoriteBrands, setFavoriteBrands)}
                  className={`border px-3 py-2 text-[12px] font-medium ${favoriteBrands.includes(make) ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}>
                  {make.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">What do you like to drive?</h1>
            <div className="grid grid-cols-2 gap-2">
              {vehicleTypes.map((type) => (
                <button key={type} type="button" onClick={() => toggle(type, preferredVehicleTypes, setPreferredVehicleTypes)}
                  className={`border px-3 py-2 text-[12px] font-medium ${preferredVehicleTypes.includes(type) ? 'bg-foreground text-background border-foreground' : 'border-border hover:bg-muted'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0 || loading} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</Button>
          <Button disabled={loading} onClick={next}>{loading ? 'Saving...' : step === 4 ? 'Finish' : 'Continue'}</Button>
        </div>
      </section>
    </div>
  );
}
