import { useEffect, useState } from 'react';
import { Input, type InputProps } from './Input';

/** Input with local editing state that commits on blur / submit (works identically on web and native). */
export function CommitInput({ value, onCommit, ...rest }: Omit<InputProps, 'value' | 'onChangeText'> & { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setV(value);
  }, [value, focused]);
  return (
    <Input
      {...rest}
      value={v}
      onChangeText={setV}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (v !== value) onCommit(v);
      }}
      onSubmitEditing={() => v !== value && onCommit(v)}
    />
  );
}
