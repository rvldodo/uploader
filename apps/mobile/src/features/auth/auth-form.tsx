import {
  loginRequestSchema,
  PASSWORD_MIN_LENGTH,
  registerRequestSchema,
} from '@media-upload/contracts'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'expo-router'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import { spacing, useTheme } from '@/lib/theme'
import { useAuth } from './auth-context'

type Mode = 'login' | 'register'
type Field = 'name' | 'email' | 'password'

export function AuthForm({ mode }: { mode: Mode }) {
  const isRegister = mode === 'register'
  const { colors } = useTheme()
  const auth = useAuth()
  const [values, setValues] = useState<Record<Field, string>>({ name: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  const mutation = useMutation({
    mutationFn: async () =>
      isRegister
        ? auth.register(registerRequestSchema.parse(values))
        : auth.login(loginRequestSchema.parse(values)),
    // On success the auth state flips and Stack.Protected navigates into the app.
  })

  const submit = () => {
    // Same schemas the API validates with: instant feedback, no round-trip.
    const result = (isRegister ? registerRequestSchema : loginRequestSchema).safeParse(values)
    if (!result.success) {
      const errors: Partial<Record<Field, string>> = {}
      for (const issue of result.error.issues) errors[issue.path[0] as Field] ??= issue.message
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    mutation.mutate()
  }

  const set = (field: Field) => (text: string) => setValues((v) => ({ ...v, [field]: text }))

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={isRegister ? ['bottom'] : ['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {!isRegister && (
            <View style={styles.brand}>
              <View style={[styles.logo, { backgroundColor: colors.accent }]}>
                <Text style={styles.logoText}>M</Text>
              </View>
              <Text style={[styles.title, { color: colors.fg }]}>Mediabox</Text>
              <Text style={{ color: colors.fgMuted, fontSize: 15 }}>Log in to your library</Text>
            </View>
          )}

          {mutation.isError && (
            <View
              accessibilityRole="alert"
              style={[styles.alert, { backgroundColor: `${colors.danger}1A` }]}
            >
              <Text style={{ color: colors.danger }}>{mutation.error.message}</Text>
            </View>
          )}

          <View style={styles.fields}>
            {isRegister && (
              <TextField
                label="Name"
                value={values.name}
                onChangeText={set('name')}
                error={fieldErrors.name}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
            <TextField
              ref={emailRef}
              label="Email"
              value={values.email}
              onChangeText={set('email')}
              error={fieldErrors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextField
              ref={passwordRef}
              label="Password"
              value={values.password}
              onChangeText={set('password')}
              error={fieldErrors.password}
              hint={isRegister ? `At least ${PASSWORD_MIN_LENGTH} characters` : undefined}
              secureTextEntry
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              textContentType={isRegister ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>

          <Button
            title={isRegister ? 'Create account' : 'Log in'}
            loading={mutation.isPending}
            onPress={submit}
          />

          {!isRegister && (
            <Text style={[styles.footer, { color: colors.fgMuted }]}>
              New here?{' '}
              <Link href="/register" style={{ color: colors.accent, fontWeight: '600' }}>
                Create an account
              </Link>
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '700' },
  alert: { padding: spacing.md, borderRadius: 12 },
  fields: { gap: spacing.lg },
  footer: { textAlign: 'center', fontSize: 15 },
})
