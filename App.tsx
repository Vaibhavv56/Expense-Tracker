import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
} from '@expo-google-fonts/lexend';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  clearLocalCurrentUser,
  loadLocalDbSnapshot,
  saveLocalBanks,
  saveLocalCurrentUser,
  saveLocalExpenses,
  saveLocalUsers,
} from './localDb';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import ConfettiCannon from 'react-native-confetti-cannon';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  UIManager,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  Banks: undefined;
  Statistics: undefined;
  AddBank: undefined;
  BankAdded: undefined;
  AddExpense: undefined;
  ExpenseAdded: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const logoImage = require('./assets/logo.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 390;

const scale = (size: number) => Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rf = (size: number, min: number, max: number) => clamp(scale(size), min, max);

type ExpoLinearGradientProps = ComponentProps<typeof ExpoLinearGradient>;

/**
 * Expo's native linear gradient can hit Fabric ClassCastException (String→Boolean) on Android.
 * Use a solid fill from a middle stop so layout and colors stay close.
 */
function LinearGradient({
  colors,
  style,
  children,
  start,
  end,
  locations,
  dither,
  ...rest
}: ExpoLinearGradientProps) {
  if (Platform.OS === 'android') {
    const fill = colors[Math.min(1, colors.length - 1)];
    return (
      <View style={[style, { backgroundColor: fill as string }]} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <ExpoLinearGradient
      colors={colors}
      style={style}
      start={start}
      end={end}
      locations={locations}
      dither={dither}
      {...rest}
    >
      {children}
    </ExpoLinearGradient>
  );
}

/** Plain View + insets avoids RNCSafeAreaView Fabric bugs (Android ClassCastException). */
function ScreenSafeArea({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[style, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>{children}</View>
  );
}

/** Android: `KeyboardAvoidingView` + `behavior="height"` fights `adjustResize` and causes post-mount jitter. */
function KeyboardSafeArea({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView behavior="padding" style={styles.flex} keyboardVerticalOffset={0}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={styles.flex}>{children}</View>;
}

type User = {
  username: string;
  email: string;
  password: string;
};

type BankCard = {
  id: string;
  name: string;
  balance: number;
  gradient: readonly [string, string, string];
  accountNumber?: string;
  ifscCode?: string;
};

type TransactionItem = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  time: string;
  amount: number;
};

type StatsCategoryItem = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  percent: number;
  amount: number;
};

type StatsDataPoint = {
  month: string;
  expense: number;
  income: number;
};

type ExpenseItem = {
  id: string;
  entryType: 'expense' | 'income';
  category: string;
  description: string;
  date: string;
  amount: number;
  bankId?: string;
  bankName?: string;
};

const DUMMY_VAIBHAV_USER: User = {
  username: 'Vaibhav Pujari',
  email: 'vaibhav@mywallet.com',
  password: 'Vaibhav@123',
};

const DUMMY_BANK_CARDS: BankCard[] = [
  {
    id: 'bank_1',
    name: 'HDFC Debit Premium',
    balance: 7466.65,
    gradient: ['#5660FA', '#8BA4D2', '#95E2A5'],
  },
  {
    id: 'bank_2',
    name: 'Axis bank',
    balance: 7466.65,
    gradient: ['#5660FA', '#C5C5C5', '#E5D668'],
  },
  {
    id: 'bank_3',
    name: 'Sarkari Grahayojana Bank',
    balance: 7466.65,
    gradient: ['#5660FA', '#8A6DD6', '#D69AD8'],
  },
];

const DUMMY_TRANSACTIONS: TransactionItem[] = [
  { id: 'txn_1', icon: 'cart', title: 'Shopping', time: '12:10 PM, Today', amount: 1000 },
  { id: 'txn_2', icon: 'silverware-fork-knife', title: 'Restaurant', time: '11:00 PM, Today', amount: 1000 },
  { id: 'txn_3', icon: 'movie-open-play', title: 'Movies', time: '12:00 AM, Today', amount: 1000 },
];

const VAIBHAV_STATS_MONTHLY: StatsDataPoint[] = [
  { month: 'Jan', expense: 1200.2, income: 1900.4 },
  { month: 'Feb', expense: 1820.5, income: 2200.1 },
  { month: 'Mar', expense: 1550.15, income: 2080.8 },
  { month: 'Apr', expense: 2000.56, income: 2450.5 },
  { month: 'May', expense: 1810.4, income: 2240.2 },
  { month: 'Jun', expense: 1790.25, income: 2300.65 },
];

const VAIBHAV_STATS_WEEKLY: StatsDataPoint[] = [
  { month: 'W1', expense: 420.1, income: 580.4 },
  { month: 'W2', expense: 540.35, income: 620.2 },
  { month: 'W3', expense: 460.2, income: 590.45 },
  { month: 'W4', expense: 580.56, income: 670.1 },
  { month: 'W5', expense: 520.8, income: 640.35 },
  { month: 'W6', expense: 500.15, income: 660.25 },
];

type AuthContextType = {
  users: User[];
  currentUser: User | null;
  banks: BankCard[];
  expenses: ExpenseItem[];
  isHydrated: boolean;
  /** Dev/testing: ensure seeded Vaibhav user exists and sign in as them. */
  skipToDemoUser: () => void;
  signUp: (user: User) => Promise<void>;
  logIn: (email: string, password: string) => Promise<boolean>;
  logOut: () => Promise<void>;
  addBank: (bank: { name: string; accountNumber: string; ifscCode: string }) => Promise<void>;
  reorderBanks: (updatedBanks: BankCard[]) => Promise<void>;
  addExpense: (expense: Omit<ExpenseItem, 'id'>) => Promise<void>;
};

type BanksByUser = Record<string, BankCard[]>;
type ExpensesByUser = Record<string, ExpenseItem[]>;

const AuthContext = createContext<AuthContextType | null>(null);
const ThemeContext = createContext<{ isDark: boolean; toggleTheme: () => void } | null>(null);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeContext provider');
  }
  return context;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [banksByUser, setBanksByUser] = useState<BanksByUser>({});
  const [expensesByUser, setExpensesByUser] = useState<ExpensesByUser>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const userKey = currentUser?.email.toLowerCase().trim() ?? '';
  const banks = userKey ? banksByUser[userKey] ?? [] : [];
  const expenses = userKey ? expensesByUser[userKey] ?? [] : [];

  useEffect(() => {
    const hydrateDatabase = async () => {
      try {
        const { usersJson, currentUserJson, banksJson, expensesJson } = await loadLocalDbSnapshot();

        if (usersJson) {
          setUsers(JSON.parse(usersJson) as User[]);
        } else {
          setUsers([DUMMY_VAIBHAV_USER]);
        }

        if (currentUserJson) {
          setCurrentUser(JSON.parse(currentUserJson) as User);
        }

        if (banksJson) {
          setBanksByUser(JSON.parse(banksJson) as BanksByUser);
        } else {
          setBanksByUser({
            [DUMMY_VAIBHAV_USER.email.toLowerCase()]: DUMMY_BANK_CARDS,
          });
        }

        if (expensesJson) {
          setExpensesByUser(JSON.parse(expensesJson) as ExpensesByUser);
        } else {
          setExpensesByUser({
            [DUMMY_VAIBHAV_USER.email.toLowerCase()]: [
              { id: 'exp_1', entryType: 'expense', category: 'Shopping', description: 'New shoes', date: '12:10 PM, Today', amount: 1000 },
              { id: 'exp_2', entryType: 'expense', category: 'Restaurant', description: 'Dinner', date: '11:00 PM, Today', amount: 1000 },
              { id: 'exp_3', entryType: 'expense', category: 'Movies', description: 'Weekend show', date: '12:00 AM, Today', amount: 1000 },
            ],
          });
        }
      } catch {
        // Keep defaults if read fails.
      } finally {
        setIsHydrated(true);
      }
    };

    hydrateDatabase();
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveLocalUsers(JSON.stringify(users)).catch(() => {});
  }, [users, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveLocalBanks(JSON.stringify(banksByUser)).catch(() => {});
  }, [banksByUser, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveLocalExpenses(JSON.stringify(expensesByUser)).catch(() => {});
  }, [expensesByUser, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!currentUser) {
      clearLocalCurrentUser().catch(() => {});
      return;
    }

    saveLocalCurrentUser(JSON.stringify(currentUser)).catch(() => {});
  }, [currentUser, isHydrated]);

  const value = useMemo<AuthContextType>(
    () => ({
      users,
      currentUser,
      banks,
      expenses,
      isHydrated,
      skipToDemoUser: () => {
        setUsers((prev) => {
          const key = DUMMY_VAIBHAV_USER.email.toLowerCase();
          if (prev.some((u) => u.email.toLowerCase() === key)) return prev;
          return [...prev, DUMMY_VAIBHAV_USER];
        });
        setCurrentUser(DUMMY_VAIBHAV_USER);
      },
      signUp: async (user) => setUsers((prev) => [...prev, user]),
      logIn: async (email, password) => {
        const normalizedEmail = email.toLowerCase().trim();
        const matchedUser = users.find(
          (user) => user.email.toLowerCase() === normalizedEmail && user.password === password
        );
        if (matchedUser) {
          setCurrentUser(matchedUser);
          return true;
        }

        // Always allow demo account login for live demos, even if local storage was reset/corrupted.
        if (
          normalizedEmail === DUMMY_VAIBHAV_USER.email.toLowerCase() &&
          password === DUMMY_VAIBHAV_USER.password
        ) {
          setUsers((prev) => {
            if (prev.some((user) => user.email.toLowerCase() === DUMMY_VAIBHAV_USER.email.toLowerCase())) {
              return prev;
            }
            return [...prev, DUMMY_VAIBHAV_USER];
          });
          setCurrentUser(DUMMY_VAIBHAV_USER);
          return true;
        }

        return false;
      },
      logOut: async () => setCurrentUser(null),
      addBank: async (bank) =>
        setBanksByUser((prev) => {
          if (!userKey) return prev;
          const currentBanks = prev[userKey] ?? [];
          const newBank: BankCard = {
            id: `bank_${Date.now()}`,
            name: bank.name,
            balance: 7466.65,
            gradient: DUMMY_BANK_CARDS[currentBanks.length % DUMMY_BANK_CARDS.length].gradient,
            accountNumber: bank.accountNumber,
            ifscCode: bank.ifscCode,
          };
          return { ...prev, [userKey]: [newBank, ...currentBanks] };
        }),
      reorderBanks: async (updatedBanks) =>
        setBanksByUser((prev) => {
          if (!userKey) return prev;
          return { ...prev, [userKey]: updatedBanks };
        }),
      addExpense: async (expense) =>
        setExpensesByUser((prev) => {
          if (!userKey) return prev;
          const currentExpenses = prev[userKey] ?? [];
          const created: ExpenseItem = { id: `exp_${Date.now()}`, ...expense };
          return { ...prev, [userKey]: [created, ...currentExpenses] };
        }),
    }),
    [users, currentUser, banks, expenses, isHydrated, userKey]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AnimatedScreen({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function BackgroundGlow({ isDark }: { isDark: boolean }) {
  if (!isDark) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E7E7E7' }]} pointerEvents="none" />;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#000000', '#02130f', '#071120']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.circle, styles.circleOne]} />
      <View style={[styles.circle, styles.circleTwo]} />
      <View style={[styles.circle, styles.circleThree]} />
    </View>
  );
}

function getGreetingByHour() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

function formatCurrency(value: number) {
  return `$ ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatExpenseDateLabel(value: Date) {
  return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function BottomNavBar({
  navigation,
  activeTab,
}: {
  navigation: any;
  activeTab: 'home' | 'stats';
}) {
  const { isDark } = useThemeMode();
  const activeColor = isDark ? '#FFFFFF' : '#050509';
  const inactiveColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(5,5,9,0.55)';
  return (
    <View style={styles.bottomNavWrap}>
      <LinearGradient colors={['#5660FA', '#95E2A5']} style={styles.bottomNav}>
        <Pressable style={styles.navIconBtn} onPress={() => navigation.navigate('Home')}>
          <Feather
            name="home"
            size={rf(28, 22, 30)}
            color={activeTab === 'home' ? activeColor : inactiveColor}
          />
        </Pressable>
        <Pressable style={styles.navIconBtn} onPress={() => navigation.navigate('Statistics')}>
          <MaterialCommunityIcons
            name="chart-bar"
            size={rf(30, 24, 32)}
            color={activeTab === 'stats' ? activeColor : inactiveColor}
          />
        </Pressable>
      </LinearGradient>
      <Pressable style={styles.floatingPlus} onPress={() => navigation.navigate('AddExpense')}>
        <Feather name="plus" size={rf(36, 28, 38)} color="#050509" />
      </Pressable>
    </View>
  );
}

function ThemeToggleButton() {
  const { isDark, toggleTheme } = useThemeMode();
  const transition = useRef(new Animated.Value(isDark ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(transition, {
      toValue: isDark ? 0 : 1,
      duration: 480,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [isDark, transition]);

  const moonOpacity = transition.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0.35, 0] });
  const sunOpacity = transition.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0.35, 1] });
  const moonScale = transition.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });
  const sunScale = transition.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const moonRotate = transition.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-28deg'] });
  const sunRotate = transition.interpolate({ inputRange: [0, 1], outputRange: ['28deg', '0deg'] });
  const iconColor = isDark ? '#FFFFFF' : '#111111';

  return (
    <Pressable onPress={toggleTheme} style={[styles.themeToggleBtn, !isDark && styles.lightThemeToggleBtn]}>
      <Animated.View
        style={[
          styles.toggleIconLayer,
          { opacity: moonOpacity, transform: [{ scale: moonScale }, { rotate: moonRotate }] },
        ]}
      >
        <Feather name="moon" size={rf(28, 22, 30)} color={iconColor} />
      </Animated.View>
      <Animated.View
        style={[
          styles.toggleIconLayer,
          { opacity: sunOpacity, transform: [{ scale: sunScale }, { rotate: sunRotate }] },
        ]}
      >
        <Feather name="sun" size={rf(28, 22, 30)} color={iconColor} />
      </Animated.View>
    </Pressable>
  );
}

function TopGreeting({ username }: { username: string }) {
  const { isDark } = useThemeMode();
  return (
    <View style={styles.headerRow}>
      <View style={styles.profileWrap}>
        <View style={styles.avatarCircle} />
        <View>
          <Text style={[styles.greetingText, !isDark && styles.lightGreetingText]}>{getGreetingByHour()}</Text>
          <Text style={[styles.usernameText, !isDark && styles.lightUsernameText]}>{username}</Text>
        </View>
      </View>
      <ThemeToggleButton />
    </View>
  );
}

function TopIconOnly() {
  const { isDark } = useThemeMode();
  return (
    <View style={styles.iconOnlyHeaderRow}>
      <View style={styles.avatarCircle} />
      <ThemeToggleButton />
    </View>
  );
}

function AnimatedCard({
  children,
  delay = 0,
  onPress,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  onPress?: () => void;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 380,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  const card = (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }, { scale: scaleValue }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );

  if (!onPress) {
    return card;
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scaleValue, { toValue: 0.98, useNativeDriver: true, speed: 25, bounciness: 4 }).start()
      }
      onPressOut={() =>
        Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 4 }).start()
      }
    >
      {card}
    </Pressable>
  );
}

function OnboardingScreen({ navigation }: { navigation: any }) {
  const { isDark } = useThemeMode();
  const { width } = useWindowDimensions();
  const logoWidth = clamp(width * 0.56, 220, 300);

  return (
    <AnimatedScreen>
      <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
        <BackgroundGlow isDark={isDark} />
        <View style={styles.onboardingTop}>
          <Image source={logoImage} style={[styles.logoTop, { width: logoWidth }]} resizeMode="contain" />
        </View>

        <View style={styles.heroContainer}>
          <Text style={styles.heroTitle}>
            The best way to{'\n'}manage your{'\n'}
            <Text style={styles.heroAccent}>money</Text>
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Signup')}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          <View style={styles.bottomLoginRow}>
            <Text style={styles.subtleText}>Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.bottomLink}>Log in</Text>
            </Pressable>
          </View>
        </View>
      </ScreenSafeArea>
    </AnimatedScreen>
  );
}

type AuthScreenProps = {
  navigation: any;
  title: string;
  subtitle: string;
  isSignup?: boolean;
  buttonLabel: string;
};

function AuthScreen({ navigation, title, subtitle, isSignup, buttonLabel }: AuthScreenProps) {
  const { users, signUp, logIn, isHydrated } = useAuth();
  const { isDark } = useThemeMode();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const shouldUseTapDismiss = Platform.OS !== 'web';

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if ((!isSignup && (!trimmedEmail || !password)) || (isSignup && (!trimmedUsername || !trimmedEmail || !password))) {
      setError('Please fill all required fields.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept terms & conditions to continue.');
      return;
    }

    if (isSignup) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const userExists = users.some((user) => user.email.toLowerCase() === trimmedEmail.toLowerCase());
      if (userExists) {
        setError('This email is already registered.');
        return;
      }

      await signUp({
        username: trimmedUsername,
        email: trimmedEmail,
        password,
      });

      setSuccess('Account created successfully. Please log in.');
      setTimeout(() => navigation.replace('Login'), 350);
      return;
    }

    const loggedIn = await logIn(trimmedEmail, password);
    if (!loggedIn) {
      setError('Invalid credentials. Please try again.');
      return;
    }

    setSuccess('Login successful.');
    setTimeout(() => navigation.replace('Home'), 250);
  };

  const content = (
    <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
      <BackgroundGlow isDark={isDark} />
      <KeyboardSafeArea>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
                <Text style={styles.authTitle}>{title}</Text>
                <Text style={styles.authSubtitle}>{subtitle}</Text>

                {isSignup ? (
                  <TextInput
                    placeholder="Username"
                    placeholderTextColor="#A1A1AA"
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    returnKeyType="next"
                  />
                ) : null}

                <TextInput
                  placeholder="Email"
                  placeholderTextColor="#A1A1AA"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  returnKeyType="next"
                />

                <View>
                  <TextInput
                    placeholder={isSignup ? 'Enter Password' : 'Password'}
                    placeholderTextColor="#A1A1AA"
                    style={[styles.input, styles.passwordInput]}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType={isSignup ? 'next' : 'done'}
                  />
                  <Pressable
                    style={styles.passwordEyeBtn}
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={10}
                  >
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={rf(20, 18, 22)} color="#D4D4D8" />
                  </Pressable>
                </View>

                {isSignup ? (
                  <View>
                    <TextInput
                      placeholder="Re-enter Password"
                      placeholderTextColor="#A1A1AA"
                      style={[styles.input, styles.passwordInput]}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      returnKeyType="done"
                    />
                    <Pressable
                      style={styles.passwordEyeBtn}
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      hitSlop={10}
                    >
                      <Feather
                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                        size={rf(20, 18, 22)}
                        color="#D4D4D8"
                      />
                    </Pressable>
                  </View>
                ) : null}

                <Pressable style={styles.checkboxRow} onPress={() => setAcceptedTerms((prev) => !prev)}>
                  <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                    {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={styles.checkboxTextWrap}>
                    <Text style={styles.checkboxPrimary}>
                      I have read and agree to the terms & conditions
                    </Text>
                    <Text style={styles.checkboxSecondary}>
                      I have read and agree to the terms and conditions
                    </Text>
                  </View>
                </Pressable>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {success ? <Text style={styles.successText}>{success}</Text> : null}

                <Pressable style={styles.gradientButtonWrap} onPress={handleSubmit} disabled={!isHydrated}>
                  <LinearGradient
                    colors={!isHydrated ? ['#3F3F46', '#52525B'] : ['#5660FA', '#89DFA2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    <Text style={styles.gradientButtonText}>{isHydrated ? buttonLabel : 'Loading...'}</Text>
                  </LinearGradient>
                </Pressable>

                <View style={styles.authSwitchRow}>
                  <Text style={styles.subtleText}>
                    {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                  </Text>
                  <Pressable onPress={() => navigation.replace(isSignup ? 'Login' : 'Signup')}>
                    <Text style={styles.bottomLink}>{isSignup ? 'Log in' : 'Sign up'}</Text>
                  </Pressable>
                </View>
          </View>
        </ScrollView>
      </KeyboardSafeArea>
    </ScreenSafeArea>
  );

  return (
    <AnimatedScreen>
      {shouldUseTapDismiss && Platform.OS === 'ios' ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>
      ) : (
        content
      )}
    </AnimatedScreen>
  );
}

function LoginScreenWithNav({ navigation }: { navigation: any }) {
  return (
    <AuthScreen
      navigation={navigation}
      title="Welcome back!"
      subtitle="Please enter your credentials"
      buttonLabel="Next"
    />
  );
}

function SignupScreenWithNav({ navigation }: { navigation: any }) {
  return (
    <AuthScreen
      navigation={navigation}
      title="Tell us about yourself"
      subtitle="Please enter your legal name below"
      isSignup
      buttonLabel="Next"
    />
  );
}

function HomeScreen({ navigation }: { navigation: any }) {
  const { currentUser, banks } = useAuth();
  const { isDark } = useThemeMode();
  const totalBalance = banks.reduce((sum, bank) => sum + bank.balance, 0);
  const username = currentUser?.username ?? 'Vaibhav Pujari';

  return (
    <AnimatedScreen>
      <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
        <BackgroundGlow isDark={isDark} />
        <View style={styles.dashboardContainer}>
          <TopGreeting username={username} />

          <AnimatedCard delay={70} onPress={() => navigation.navigate('Banks')}>
            <LinearGradient
              colors={['#5660FA', '#8BA4D2', '#95E2A5']}
              style={styles.totalBalanceCard}
              start={{ x: 0, y: 0.1 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.ring, styles.ringTopRight]} />
              <View style={[styles.ring, styles.ringBottomLeft]} />
              <Text style={styles.totalBalanceLabel}>Your Total Balance</Text>
              <Text style={styles.totalBalanceAmount}>{formatCurrency(totalBalance)}</Text>
            </LinearGradient>
          </AnimatedCard>

          <Text style={[styles.sectionHeading, !isDark && styles.lightTextPrimary]}>Transactions</Text>

          <View style={styles.statCardsRow}>
            <AnimatedCard style={[styles.statCard, !isDark && styles.lightSoftCard]} delay={130}>
              <MaterialCommunityIcons name="arrow-up-thin" size={rf(46, 32, 48)} color="#41E5BF" />
              <Text style={styles.statPercent}>40%</Text>
              <Text style={[styles.statLabel, !isDark && styles.lightTextPrimary]}>Expenses</Text>
            </AnimatedCard>
            <AnimatedCard style={[styles.statCard, !isDark && styles.lightSoftCard]} delay={190}>
              <MaterialCommunityIcons name="arrow-down-thin" size={rf(46, 32, 48)} color="#41E5BF" />
              <Text style={styles.statPercent}>40%</Text>
              <Text style={[styles.statLabel, !isDark && styles.lightTextPrimary]}>Income</Text>
            </AnimatedCard>
          </View>

          <View style={styles.transactionsList}>
            {DUMMY_TRANSACTIONS.map((item, index) => (
              <AnimatedCard
                key={item.id}
                style={[styles.transactionCard, !isDark && styles.lightSoftCard]}
                delay={250 + index * 60}
              >
                <View style={styles.transactionLeft}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={rf(32, 24, 34)}
                    color={isDark ? '#F5F5F5' : '#111111'}
                  />
                  <View>
                    <Text style={[styles.transactionTitle, !isDark && styles.lightTextPrimary]}>{item.title}</Text>
                    <Text style={[styles.transactionTime, !isDark && styles.lightTextMuted]}>{item.time}</Text>
                  </View>
                </View>
                <Text style={[styles.transactionAmount, !isDark && styles.lightTextPrimary]}>${item.amount}</Text>
              </AnimatedCard>
            ))}
          </View>
        </View>
        <BottomNavBar navigation={navigation} activeTab="home" />
      </ScreenSafeArea>
    </AnimatedScreen>
  );
}

function BanksScreen({ navigation }: { navigation: any }) {
  const { isDark } = useThemeMode();
  const { banks, reorderBanks } = useAuth();
  const listRef = useRef<FlatList<BankCard>>(null);
  const currentOffset = useRef(0);
  const arrowBob = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [listViewportH, setListViewportH] = useState(0);
  const [listContentH, setListContentH] = useState(0);
  const bottomDimOpacity = scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [0.1, 0],
    extrapolate: 'clamp',
  });

  const showViewMore =
    banks.length > 0 && listViewportH > 0 && listContentH > listViewportH + 12;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!showViewMore) {
      arrowBob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowBob, { toValue: 6, duration: 600, useNativeDriver: true }),
        Animated.timing(arrowBob, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [arrowBob, showViewMore]);

  const onBankListLayout = (e: LayoutChangeEvent) => {
    setListViewportH(e.nativeEvent.layout.height);
  };

  const onBankListContentSizeChange = (_w: number, h: number) => {
    setListContentH(h);
  };

  const moveBank = (from: number, to: number) => {
    if (to < 0 || to >= banks.length) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = [...banks];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    void reorderBanks(next);
  };

  const handleViewMore = () => {
    const nextOffset = currentOffset.current + 190;
    listRef.current?.scrollToOffset({ offset: nextOffset, animated: true });
    currentOffset.current = nextOffset;
  };

  return (
    <AnimatedScreen>
      <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
        <BackgroundGlow isDark={isDark} />
        <View style={styles.dashboardContainer}>
          <TopIconOnly />

          <View style={styles.addNewWrap}>
            <Pressable onPress={() => navigation.navigate('AddBank')}>
              <LinearGradient
                colors={['#22243E', '#384D80']}
                style={styles.addNewBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.addNewText}>Add New</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.bankList} onLayout={onBankListLayout}>
            <FlatList
              ref={listRef}
              data={banks}
              keyExtractor={(item) => item.id}
              scrollEnabled
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              onContentSizeChange={onBankListContentSizeChange}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                scrollY.setValue(y);
                currentOffset.current = y;
              }}
              scrollEventThrottle={16}
              contentContainerStyle={styles.bankListContent}
              renderItem={({ item, index }) => (
                <View style={styles.bankCardStackItem}>
                  <LinearGradient
                    colors={item.gradient as [string, string, string]}
                    start={{ x: 0, y: 0.1 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bankCard, !isDark && styles.lightBankCardBorder]}
                  >
                    <View style={[styles.ring, styles.ringTopRight]} />
                    <View style={[styles.ring, styles.ringBottomLeft]} />
                    <Text style={styles.bankName}>{item.name}</Text>
                    <Text style={styles.bankAmount}>{formatCurrency(item.balance)}</Text>
                    <View style={styles.bankReorderOverlay} pointerEvents="box-none">
                      <Pressable
                        style={({ pressed }) => [
                          styles.bankReorderHit,
                          pressed && styles.bankReorderHitPressed,
                          index === 0 && styles.bankReorderHitDisabled,
                        ]}
                        disabled={index === 0}
                        onPress={() => moveBank(index, index - 1)}
                        accessibilityLabel="Move bank up"
                      >
                        <MaterialCommunityIcons
                          name="chevron-up"
                          size={rf(22, 18, 24)}
                          color="rgba(255,255,255,0.95)"
                        />
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.bankReorderHit,
                          pressed && styles.bankReorderHitPressed,
                          index >= banks.length - 1 && styles.bankReorderHitDisabled,
                        ]}
                        disabled={index >= banks.length - 1}
                        onPress={() => moveBank(index, index + 1)}
                        accessibilityLabel="Move bank down"
                      >
                        <MaterialCommunityIcons
                          name="chevron-down"
                          size={rf(22, 18, 24)}
                          color="rgba(255,255,255,0.95)"
                        />
                      </Pressable>
                    </View>
                  </LinearGradient>
                </View>
              )}
            />
            {showViewMore ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.viewMoreDimLayer,
                  { opacity: bottomDimOpacity },
                ]}
              />
            ) : null}
          </View>

          {showViewMore ? (
            <Pressable style={styles.viewMoreBtn} onPress={handleViewMore}>
              <Text style={[styles.viewMoreText, !isDark && styles.lightTextPrimary]}>View more</Text>
              <Animated.View style={{ transform: [{ translateY: arrowBob }] }}>
                <MaterialCommunityIcons
                  name="chevron-double-down"
                  size={rf(30, 22, 32)}
                  color={isDark ? '#FFFFFF' : '#111111'}
                />
              </Animated.View>
            </Pressable>
          ) : null}
        </View>
        <BottomNavBar navigation={navigation} activeTab="home" />
      </ScreenSafeArea>
    </AnimatedScreen>
  );
}

function AddBankScreen({ navigation }: { navigation: any }) {
  const { isDark } = useThemeMode();
  const { addBank } = useAuth();
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const shouldUseTapDismiss = Platform.OS !== 'web';

  const handleConfirm = async () => {
    setError('');
    if (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
      setError('Please fill all bank details.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept terms & conditions.');
      return;
    }

    await addBank({
      name: bankName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
    });
    navigation.replace('BankAdded');
  };

  const content = (
    <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
      <BackgroundGlow isDark={isDark} />
      <KeyboardSafeArea>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.addBankScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.addBankHeaderRow}>
            <View style={styles.avatarCircle} />
            <Pressable style={styles.addBankBackBtn} onPress={() => navigation.goBack()}>
              <LinearGradient
                colors={['#5660FA', '#89DFA2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addBankBackBtnGradient}
              >
                <Text style={styles.addBankBackBtnText}>Back</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.addBankTitleRow}>
            <Text style={[styles.addBankTitle, !isDark && styles.lightTextPrimary]}>Enter Bank Details</Text>
            <MaterialCommunityIcons name="bank" size={rf(38, 28, 40)} color="#5B8CFF" />
          </View>

              <TextInput
                placeholder="Bank Name"
                placeholderTextColor="#A1A1AA"
                style={[styles.input, styles.addBankInput, !isDark && styles.lightInput]}
                value={bankName}
                onChangeText={setBankName}
              />
              <TextInput
                placeholder="Account Number"
                placeholderTextColor="#A1A1AA"
                style={[styles.input, styles.addBankInput, !isDark && styles.lightInput]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="number-pad"
              />
              <TextInput
                placeholder="IFSC Code"
                placeholderTextColor="#A1A1AA"
                style={[styles.input, styles.addBankInput, !isDark && styles.lightInput]}
                value={ifscCode}
                onChangeText={setIfscCode}
                autoCapitalize="characters"
              />

              <Pressable style={styles.checkboxRow} onPress={() => setAcceptedTerms((prev) => !prev)}>
                <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={styles.checkboxTextWrap}>
                  <Text style={styles.checkboxPrimary}>I have read and agree to the terms & conditions</Text>
                  <Text style={styles.checkboxSecondary}>I have read and agree to the terms and conditions</Text>
                </View>
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable style={styles.gradientButtonWrap} onPress={handleConfirm}>
                <LinearGradient
                  colors={['#5660FA', '#89DFA2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.gradientButtonText}>Confirm</Text>
                </LinearGradient>
              </Pressable>
        </ScrollView>
      </KeyboardSafeArea>
    </ScreenSafeArea>
  );

  return (
    <AnimatedScreen>
      {shouldUseTapDismiss && Platform.OS === 'ios' ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>
      ) : (
        content
      )}
    </AnimatedScreen>
  );
}

function AddExpenseScreen({ navigation }: { navigation: any }) {
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { addExpense, banks } = useAuth();
  const [entryType, setEntryType] = useState<'expense' | 'income'>('expense');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [selectedBank, setSelectedBank] = useState<{ id: string; name: string } | null>(null);
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [date, setDate] = useState(() => formatExpenseDateLabel(new Date()));
  const [amountText, setAmountText] = useState('0');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
  const addExpenseContentOpacity = useRef(new Animated.Value(1)).current;
  const addExpenseContentTranslateY = useRef(new Animated.Value(0)).current;

  const expenseCategories = ['Shopping', 'Restaurant', 'Movies', 'Groceries', 'Others'];
  const incomeCategories = ['Salary', 'Freelance', 'Bonus', 'Investment', 'Others'];
  const categories = entryType === 'expense' ? expenseCategories : incomeCategories;
  const parsedAmount = Number(amountText) || 0;

  const switchEntryType = (next: 'expense' | 'income') => {
    if (next === entryType) {
      return;
    }
    Animated.parallel([
      Animated.timing(addExpenseContentOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(addExpenseContentTranslateY, {
        toValue: -14,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }
      setEntryType(next);
      setCategory('');
      addExpenseContentTranslateY.setValue(18);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(addExpenseContentOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
          Animated.timing(addExpenseContentTranslateY, {
            toValue: 0,
            duration: 320,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  };

  const onDateChange = (event: DateTimePickerEvent, pickedDate?: Date) => {
    if (event.type === 'dismissed' || event.type === 'neutralButtonPressed') {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      return;
    }

    const ts = event.nativeEvent?.timestamp;
    const resolved =
      pickedDate && !Number.isNaN(pickedDate.getTime())
        ? pickedDate
        : typeof ts === 'number' && !Number.isNaN(ts)
          ? new Date(ts)
          : undefined;

    if (resolved) {
      setSelectedDate(resolved);
      setDate(formatExpenseDateLabel(resolved));
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    } else if (Platform.OS === 'web' && resolved) {
      setShowDatePicker(false);
    }
  };

  const handleAmountChange = (text: string) => {
    const sanitized = text.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    const normalized =
      parts.length <= 1 ? sanitized : `${parts[0]}.${parts.slice(1).join('')}`;
    setAmountText(normalized);
  };

  const handleSubmit = async () => {
    setError('');
    if (!category) {
      setError('Please select a category.');
      return;
    }
    if (!selectedBank) {
      setError('Please select a bank.');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a description.');
      return;
    }
    if (!date.trim()) {
      setError('Please select a date.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    await addExpense({
      entryType,
      category,
      description: description.trim(),
      date: date.trim(),
      amount: parsedAmount,
      bankId: selectedBank.id,
      bankName: selectedBank.name,
    });
    navigation.replace('ExpenseAdded');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  return (
    <AnimatedScreen>
      <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
        <BackgroundGlow isDark={isDark} />
        <KeyboardSafeArea>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.addExpenseScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconOnlyHeaderRow}>
              <View style={styles.avatarCircle} />
            </View>

            <View style={[styles.statsSwitchWrap, styles.addExpenseToggleWrap]}>
              <Pressable style={styles.statsSwitchBtn} onPress={() => switchEntryType('expense')}>
                <LinearGradient
                  colors={
                    entryType === 'expense'
                      ? (['#3039A7', '#16182A'] as [string, string])
                      : (['#0C0C12', '#0C0C12'] as [string, string])
                  }
                  style={styles.statsSwitchBtnFill}
                >
                  <Text style={styles.statsSwitchLabel}>Expense</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.statsSwitchBtn} onPress={() => switchEntryType('income')}>
                <LinearGradient
                  colors={
                    entryType === 'income'
                      ? (['#3039A7', '#16182A'] as [string, string])
                      : (['#0C0C12', '#0C0C12'] as [string, string])
                  }
                  style={styles.statsSwitchBtnFill}
                >
                  <Text style={styles.statsSwitchLabel}>Income</Text>
                </LinearGradient>
              </Pressable>
            </View>

            <Animated.View
              style={{
                opacity: addExpenseContentOpacity,
                transform: [{ translateY: addExpenseContentTranslateY }],
              }}
            >
            <TextInput
              value={amountText}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              style={[styles.amountInput, !isDark && styles.lightTextPrimary]}
              placeholder="$0"
              placeholderTextColor="#A1A1AA"
            />

            <View style={[styles.categoryContainer, !isDark && styles.lightInput]}>
              <Pressable style={styles.categoryHeader} onPress={() => setCategoryOpen((prev) => !prev)}>
                <Text style={[styles.categoryHeaderText, !isDark && styles.lightTextPrimary]}>
                  {category || 'Select category'}
                </Text>
                <Feather
                  name={categoryOpen ? 'chevron-up' : 'chevron-down'}
                  size={rf(24, 20, 26)}
                  color={isDark ? '#FFFFFF' : '#111111'}
                />
              </Pressable>
              {categoryOpen ? (
                <View style={styles.categoryOptionsWrap}>
                  {categories.map((item) => (
                    <Pressable
                      key={item}
                      style={styles.categoryOption}
                      onPress={() => {
                        setCategory(item);
                        setCategoryOpen(false);
                      }}
                    >
                      <Text style={[styles.categoryOptionText, !isDark && styles.lightTextPrimary]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={[styles.categoryContainer, !isDark && styles.lightInput]}>
              <Pressable style={styles.categoryHeader} onPress={() => setBankOpen((prev) => !prev)}>
                <Text style={[styles.categoryHeaderText, !isDark && styles.lightTextPrimary]}>
                  {selectedBank?.name || 'Select Bank'}
                </Text>
                <Feather
                  name={bankOpen ? 'chevron-up' : 'chevron-down'}
                  size={rf(24, 20, 26)}
                  color={isDark ? '#FFFFFF' : '#111111'}
                />
              </Pressable>
              {bankOpen ? (
                <View style={styles.categoryOptionsWrap}>
                  {banks.map((bank) => (
                    <Pressable
                      key={bank.id}
                      style={styles.categoryOption}
                      onPress={() => {
                        setSelectedBank({ id: bank.id, name: bank.name });
                        setBankOpen(false);
                      }}
                    >
                      <Text style={[styles.categoryOptionText, !isDark && styles.lightTextPrimary]}>
                        {bank.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <Pressable style={[styles.dateInputWrap, !isDark && styles.lightInput]} onPress={() => setShowDatePicker(true)}>
              <Text
                style={[
                  styles.dateInput,
                  !isDark && styles.lightTextPrimary,
                  !date && styles.datePlaceholderText,
                ]}
              >
                {date || 'Date'}
              </Text>
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={rf(30, 24, 32)}
                color={isDark ? '#A1A1AA' : '#111111'}
              />
            </Pressable>

            <TextInput
              placeholder="Description"
              placeholderTextColor="#A1A1AA"
              style={[styles.input, styles.addExpenseInput, !isDark && styles.lightInput]}
              value={description}
              onChangeText={setDescription}
            />

            {Platform.OS === 'android' && showDatePicker ? (
              <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onDateChange} />
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable style={[styles.gradientButtonWrap, styles.addExpenseSubmitWrap]} onPress={handleSubmit}>
              <LinearGradient
                colors={['#5660FA', '#89DFA2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <Text style={styles.gradientButtonText}>Submit</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.addExpenseBackWrap}>
              <Pressable style={[styles.gradientButtonWrap, styles.statsBackButtonWrap]} onPress={handleBack}>
                <LinearGradient
                  colors={['#5660FA', '#89DFA2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.gradientButton, styles.statsBackGradientButton]}
                >
                  <Text style={[styles.gradientButtonText, styles.statsBackButtonText]}>Back</Text>
                </LinearGradient>
              </Pressable>
            </View>
            </Animated.View>
          </ScrollView>
        </KeyboardSafeArea>
      </ScreenSafeArea>
      {Platform.OS !== 'android' ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerModalRoot}>
            <Pressable style={styles.datePickerModalBackdrop} onPress={() => setShowDatePicker(false)} />
            <View
              style={[
                styles.datePickerModalSheet,
                !isDark && styles.datePickerModalSheetLight,
                { paddingBottom: Math.max(insets.bottom, rf(20, 16, 24)) },
              ]}
            >
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                {...(Platform.OS === 'ios'
                  ? { themeVariant: isDark ? ('dark' as const) : ('light' as const) }
                  : {})}
              />
              <Pressable style={styles.datePickerDoneBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.datePickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </AnimatedScreen>
  );
}

function ExpenseAddedScreen({ navigation }: { navigation: any }) {
  const { isDark } = useThemeMode();
  const tickOpacity = useRef(new Animated.Value(0)).current;
  const tickScale = useRef(new Animated.Value(0.6)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(tickOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.spring(tickScale, {
          toValue: 1,
          friction: 6,
          tension: 130,
          useNativeDriver: true,
        }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ),
    ]).start();
  }, [tickOpacity, tickScale, pulse]);

  return (
    <AnimatedScreen>
      <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
        <BackgroundGlow isDark={isDark} />
        <View style={styles.bankAddedWrap}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <LinearGradient colors={['#2476FF', '#26E3C2']} style={styles.successCircle}>
              <Animated.View style={{ opacity: tickOpacity, transform: [{ scale: tickScale }] }}>
                <Feather name="check" size={rf(72, 50, 74)} color="#0A0A0A" />
              </Animated.View>
            </LinearGradient>
          </Animated.View>
          <Text style={[styles.successHeading, !isDark && styles.lightTextPrimary]}>
            Expense Added{'\n'}Successfully!!
          </Text>
          <Pressable style={[styles.gradientButtonWrap, styles.successBackButtonWrap]} onPress={() => navigation.replace('Home')}>
            <LinearGradient
              colors={['#5660FA', '#89DFA2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.gradientButtonText}>Back</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScreenSafeArea>
    </AnimatedScreen>
  );
}

function BankAddedScreen({ navigation }: { navigation: any }) {
  const { isDark } = useThemeMode();
  const tickScale = useRef(new Animated.Value(0.78)).current;
  const tickRotate = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(tickScale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(tickRotate, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tickRotate, tickScale]);

  return (
    <AnimatedScreen>
      <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
        <BackgroundGlow isDark={isDark} />
        <View style={styles.bankAddedWrap}>
          {Platform.OS === 'ios' ? (
            <>
              <ConfettiCannon count={80} origin={{ x: -10, y: 0 }} fadeOut explosionSpeed={350} fallSpeed={2500} />
              <ConfettiCannon count={80} origin={{ x: 420, y: 0 }} fadeOut explosionSpeed={350} fallSpeed={2500} />
            </>
          ) : null}
          <LinearGradient colors={['#2476FF', '#26E3C2']} style={styles.successCircle}>
            <Animated.View
              style={{
                transform: [
                  { scale: tickScale },
                  {
                    rotate: tickRotate.interpolate({
                      inputRange: [-15, 15],
                      outputRange: ['-15deg', '15deg'],
                    }),
                  },
                ],
              }}
            >
              <Feather name="check" size={rf(72, 50, 74)} color="#0A0A0A" />
            </Animated.View>
          </LinearGradient>
          <Text style={[styles.successHeading, !isDark && styles.lightTextPrimary]}>
            Your Bank was added{'\n'}Successfully!!
          </Text>
          <Pressable style={[styles.gradientButtonWrap, styles.successBackButtonWrap]} onPress={() => navigation.replace('Banks')}>
            <LinearGradient
              colors={['#5660FA', '#89DFA2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.gradientButtonText}>Back</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScreenSafeArea>
    </AnimatedScreen>
  );
}

function StatisticsScreen({ navigation }: { navigation: any }) {
  const { isDark } = useThemeMode();
  const [statMode, setStatMode] = useState<'expense' | 'income'>('expense');
  const [periodMode, setPeriodMode] = useState<'Monthly' | 'Weekly'>('Monthly');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;

  const graphData = periodMode === 'Monthly' ? VAIBHAV_STATS_MONTHLY : VAIBHAV_STATS_WEEKLY;
  const chartValues = graphData.map((point) => (statMode === 'expense' ? point.expense : point.income));
  const maxValue = Math.max(...chartValues);
  const selectedTotal = chartValues.reduce((sum, value) => sum + value, 0);

  const categoryData: StatsCategoryItem[] =
    statMode === 'expense'
      ? [
          { id: 'cat_1', icon: 'cart-outline', title: 'Shopping', percent: 35, amount: 1000 },
          { id: 'cat_2', icon: 'food-outline', title: 'Food', percent: 50, amount: 5000 },
        ]
      : [
          { id: 'cat_3', icon: 'briefcase-outline', title: 'Salary', percent: 68, amount: 8000 },
          { id: 'cat_4', icon: 'cash-multiple', title: 'Freelance', percent: 22, amount: 2500 },
        ];

  const animateStatSwitch = (nextMode: 'expense' | 'income') => {
    if (nextMode === statMode) {
      return;
    }

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: -14,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }
      setStatMode(nextMode);
      contentTranslateY.setValue(18);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
          Animated.timing(contentTranslateY, {
            toValue: 0,
            duration: 320,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
        ]).start();
      });
    });
  };

  return (
    <AnimatedScreen>
      <ScreenSafeArea style={[styles.screen, !isDark && styles.lightScreen]}>
        <BackgroundGlow isDark={isDark} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.statsScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TopIconOnly />
          <Text style={[styles.statsTitle, !isDark && styles.lightTextPrimary]}>Statistics</Text>

          <View style={styles.statsSwitchWrap}>
            <Pressable style={styles.statsSwitchBtn} onPress={() => animateStatSwitch('expense')}>
              <LinearGradient
                colors={
                  statMode === 'expense' ? (['#3039A7', '#16182A'] as [string, string]) : (['#0C0C12', '#0C0C12'] as [string, string])
                }
                style={styles.statsSwitchBtnFill}
              >
                <Text style={styles.statsSwitchLabel}>Expense</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.statsSwitchBtn} onPress={() => animateStatSwitch('income')}>
              <LinearGradient
                colors={
                  statMode === 'income' ? (['#3039A7', '#16182A'] as [string, string]) : (['#0C0C12', '#0C0C12'] as [string, string])
                }
                style={styles.statsSwitchBtnFill}
              >
                <Text style={styles.statsSwitchLabel}>Income</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            }}
          >
            <Text style={[styles.statsSubTitle, !isDark && styles.lightTextMuted]}>
              Total {statMode === 'expense' ? 'Expenses' : 'Income'}
            </Text>
            <Text style={[styles.statsAmount, !isDark && styles.lightTextPrimary]}>
              ${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>

            <View style={styles.chartWrap}>
              {graphData.map((point, index) => {
                const value = statMode === 'expense' ? point.expense : point.income;
                const barHeight = clamp((value / maxValue) * rf(170, 120, 176), rf(86, 62, 90), rf(170, 120, 176));
                return (
                  <View key={`${point.month}_${index}`} style={styles.barItem}>
                    <LinearGradient
                      colors={['#5E67F8', '#95E2A5']}
                      style={[styles.bar, { height: barHeight }]}
                    />
                    <Text style={[styles.barMonth, !isDark && styles.lightTextMuted]}>{point.month}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.periodRow}>
              <Pressable style={styles.periodButton} onPress={() => setShowPeriodMenu((prev) => !prev)}>
                <LinearGradient
                  colors={['#23243E', '#3A4E80']}
                  style={styles.periodButtonFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.periodText}>{periodMode}</Text>
                  <Feather
                    name={showPeriodMenu ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={isDark ? '#D4D4D8' : '#111111'}
                  />
                </LinearGradient>
              </Pressable>
              {showPeriodMenu ? (
                <View style={styles.periodMenu}>
                  {(['Monthly', 'Weekly'] as const).map((period) => (
                    <Pressable
                      key={period}
                      style={styles.periodOption}
                      onPress={() => {
                        setPeriodMode(period);
                        setShowPeriodMenu(false);
                      }}
                    >
                      <Text style={[styles.periodOptionText, period === periodMode && styles.periodOptionTextActive]}>
                        {period}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <Text style={[styles.sectionHeading, !isDark && styles.lightTextPrimary]}>
              {statMode === 'expense' ? 'Expenses by category' : 'Income by category'}
            </Text>
            <View style={styles.transactionsList}>
              {categoryData.map((item) => (
                <AnimatedCard key={item.id} style={[styles.transactionCard, !isDark && styles.lightSoftCard]}>
                  <View style={styles.transactionLeft}>
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={rf(30, 22, 32)}
                      color={isDark ? '#F5F5F5' : '#111111'}
                    />
                    <View>
                      <Text style={[styles.transactionTitle, !isDark && styles.lightTextPrimary]}>{item.title}</Text>
                      <Text style={[styles.transactionTime, !isDark && styles.lightTextMuted]}>{item.percent}%</Text>
                    </View>
                  </View>
                  <Text style={[styles.transactionAmount, !isDark && styles.lightTextPrimary]}>${item.amount}</Text>
                </AnimatedCard>
              ))}
            </View>
          </Animated.View>
          <Pressable
            style={[styles.gradientButtonWrap, styles.statsBackButtonWrap]}
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
          >
            <LinearGradient
              colors={['#5660FA', '#89DFA2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.gradientButton, styles.statsBackGradientButton]}
            >
              <Text style={[styles.gradientButtonText, styles.statsBackButtonText]}>Back</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </ScreenSafeArea>
    </AnimatedScreen>
  );
}

export default function App() {
  const [loaded] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });
  const [isDark, setIsDark] = useState(true);
  const themeValue = useMemo(
    () => ({
      isDark,
      toggleTheme: () => setIsDark((prev) => !prev),
    }),
    [isDark]
  );

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ThemeContext.Provider value={themeValue}>
          <AuthProvider>
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName="Onboarding"
                detachInactiveScreens={false}
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  cardStyle: { backgroundColor: isDark ? '#000' : '#E7E7E7' },
                }}
              >
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="Signup" component={SignupScreenWithNav} />
                <Stack.Screen name="Login" component={LoginScreenWithNav} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Banks" component={BanksScreen} />
                <Stack.Screen name="Statistics" component={StatisticsScreen} />
                <Stack.Screen name="AddBank" component={AddBankScreen} />
                <Stack.Screen name="BankAdded" component={BankAddedScreen} />
                <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
                <Stack.Screen name="ExpenseAdded" component={ExpenseAddedScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </AuthProvider>
        </ThemeContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  lightScreen: {
    backgroundColor: '#E7E7E7',
  },
  circle: {
    position: 'absolute',
    borderColor: 'rgba(127, 127, 255, 0.22)',
    borderWidth: 1,
    borderRadius: 500,
    backgroundColor: 'rgba(66, 50, 168, 0.14)',
  },
  circleOne: {
    width: 180,
    height: 180,
    top: -35,
    right: 16,
  },
  circleTwo: {
    width: 260,
    height: 260,
    top: 130,
    left: -120,
  },
  circleThree: {
    width: 200,
    height: 200,
    bottom: 150,
    right: -100,
  },
  onboardingTop: {
    marginTop: rf(34, 26, 40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTop: {
    height: rf(170, 120, 170),
  },
  heroContainer: {
    marginTop: 'auto',
    paddingHorizontal: rf(26, 18, 30),
    paddingBottom: rf(34, 22, 40),
  },
  heroTitle: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(30, 22, 34),
    lineHeight: rf(36, 28, 40),
    maxWidth: rf(320, 230, 340),
    marginBottom: rf(28, 20, 30),
  },
  heroAccent: {
    color: '#41EA66',
  },
  primaryButton: {
    height: rf(72, 56, 74),
    borderRadius: rf(22, 16, 22),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(3, 20, 17, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: rf(17, 15, 19),
    lineHeight: rf(22, 20, 24),
    fontFamily: 'Lexend_700Bold',
  },
  bottomLoginRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingSkipWrap: {
    marginTop: rf(22, 16, 26),
    alignSelf: 'center',
    paddingVertical: rf(8, 6, 10),
    paddingHorizontal: rf(16, 12, 18),
  },
  onboardingSkipDisabled: {
    opacity: 0.35,
  },
  onboardingSkipText: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Lexend_500Medium',
    fontSize: rf(15, 13, 16),
  },
  lightOnboardingSkipText: {
    color: 'rgba(17,17,17,0.45)',
  },
  subtleText: {
    color: '#D1D5DB',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(14, 12, 16),
  },
  bottomLink: {
    color: '#FFFFFF',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 16),
  },
  formScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: rf(26, 16, 30),
    paddingVertical: rf(20, 14, 24),
  },
  addBankScrollContent: {
    flexGrow: 1,
    paddingHorizontal: rf(26, 16, 30),
    paddingVertical: rf(20, 14, 24),
  },
  addExpenseScrollContent: {
    flexGrow: 1,
    paddingHorizontal: rf(26, 16, 30),
    paddingTop: rf(20, 14, 24),
    paddingBottom: rf(26, 20, 30),
  },
  addExpenseToggleWrap: {
    marginTop: rf(14, 10, 16),
    marginBottom: rf(18, 14, 22),
  },
  amountInput: {
    color: '#A1A1AA',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(56, 40, 58),
    textAlign: 'center',
    marginBottom: rf(24, 18, 28),
  },
  categoryContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: rf(18, 12, 18),
    marginBottom: rf(18, 14, 20),
    overflow: 'hidden',
  },
  categoryHeader: {
    minHeight: rf(70, 50, 72),
    paddingHorizontal: rf(20, 14, 22),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryHeaderText: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 13, 16),
  },
  categoryOptionsWrap: {
    paddingBottom: 8,
  },
  categoryOption: {
    paddingHorizontal: rf(20, 14, 22),
    paddingVertical: rf(10, 8, 12),
  },
  categoryOptionText: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 13, 16),
  },
  addExpenseInput: {
    marginTop: rf(18, 14, 20),
    marginBottom: rf(20, 14, 22),
  },
  dateInputWrap: {
    minHeight: rf(70, 50, 72),
    borderRadius: rf(18, 12, 18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: rf(20, 14, 22),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: rf(18, 14, 20),
  },
  dateInput: {
    flex: 1,
    color: '#F8FAFC',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(14, 13, 16),
  },
  datePlaceholderText: {
    color: '#A1A1AA',
  },
  datePickerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  datePickerModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerModalSheet: {
    backgroundColor: '#12121a',
    borderTopLeftRadius: rf(18, 14, 20),
    borderTopRightRadius: rf(18, 14, 20),
    paddingTop: rf(8, 6, 10),
  },
  datePickerModalSheetLight: {
    backgroundColor: '#F2F2F7',
  },
  datePickerDoneBtn: {
    alignItems: 'center',
    paddingVertical: rf(14, 10, 16),
  },
  datePickerDoneText: {
    color: '#89DFA2',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(16, 14, 18),
  },
  addExpenseSubmitWrap: {
    marginTop: rf(14, 10, 16),
  },
  addExpenseBackWrap: {
    alignItems: 'center',
    marginTop: rf(52, 38, 56),
    marginBottom: rf(8, 6, 12),
  },
  addExpenseBackButtonWrap: {
    alignItems: 'center',
  },
  formCard: {
    gap: 14,
  },
  authTitle: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(24, 20, 28),
    marginBottom: 8,
  },
  authSubtitle: {
    color: '#E4E4E7',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(14, 12, 16),
    marginBottom: 16,
  },
  input: {
    height: rf(70, 50, 72),
    borderRadius: rf(18, 12, 18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#F8FAFC',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(14, 13, 16),
    paddingHorizontal: rf(20, 14, 22),
  },
  passwordInput: {
    paddingRight: rf(56, 44, 60),
  },
  passwordEyeBtn: {
    position: 'absolute',
    right: rf(18, 14, 20),
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  lightInput: {
    backgroundColor: '#F7F7F7',
    borderColor: 'rgba(0,0,0,0.16)',
    color: '#09090B',
  },
  addBankTitle: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(22, 18, 24),
    marginBottom: rf(16, 12, 18),
  },
  addBankHeaderRow: {
    marginTop: rf(8, 6, 12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addBankBackBtn: {
    borderRadius: rf(16, 12, 18),
    overflow: 'hidden',
  },
  addBankBackBtnGradient: {
    minWidth: rf(120, 94, 124),
    height: rf(56, 44, 58),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rf(20, 14, 22),
  },
  addBankBackBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(16, 13, 18),
  },
  backIconBtn: {
    width: rf(40, 34, 42),
    height: rf(40, 34, 42),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  addBankTitleRow: {
    marginTop: rf(22, 14, 24),
    marginBottom: rf(18, 14, 22),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addBankInput: {
    marginBottom: rf(16, 12, 18),
  },
  checkboxRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: rf(36, 24, 36),
    height: rf(36, 24, 36),
    borderRadius: rf(8, 6, 8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginTop: 4,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  checkmark: {
    color: '#06270f',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(16, 12, 16),
  },
  checkboxTextWrap: {
    flex: 1,
  },
  checkboxPrimary: {
    color: '#FFFFFF',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 16),
    lineHeight: rf(20, 16, 22),
  },
  checkboxSecondary: {
    color: '#4ADE80',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(12, 10, 13),
    marginTop: 3,
  },
  errorText: {
    color: '#F87171',
    fontFamily: 'Lexend_500Medium',
    fontSize: rf(14, 12, 14),
    marginTop: -8,
  },
  successText: {
    color: '#4ADE80',
    fontFamily: 'Lexend_500Medium',
    fontSize: rf(14, 12, 14),
    marginTop: -8,
  },
  gradientButtonWrap: {
    borderRadius: rf(18, 12, 18),
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientButton: {
    height: rf(74, 54, 76),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(17, 15, 19),
    lineHeight: rf(22, 20, 24),
  },
  authSwitchRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardContainer: {
    flex: 1,
    paddingHorizontal: rf(22, 14, 24),
  },
  headerRow: {
    marginTop: rf(8, 6, 12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconOnlyHeaderRow: {
    marginTop: rf(8, 6, 12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: rf(50, 40, 52),
    height: rf(50, 40, 52),
    borderRadius: 999,
    backgroundColor: '#BFBFBF',
  },
  greetingText: {
    color: '#D4D4D8',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(14, 12, 15),
    marginBottom: 2,
  },
  lightGreetingText: {
    color: '#3F3F46',
  },
  usernameText: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(18, 16, 22),
    lineHeight: rf(24, 20, 28),
  },
  lightUsernameText: {
    color: '#09090B',
  },
  themeToggleBtn: {
    width: rf(40, 34, 42),
    height: rf(40, 34, 42),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightThemeToggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  toggleIconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBalanceCard: {
    marginTop: rf(18, 12, 20),
    borderRadius: rf(28, 20, 30),
    paddingHorizontal: rf(28, 20, 30),
    paddingVertical: rf(28, 22, 32),
    minHeight: rf(220, 170, 230),
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 10,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  ringTopRight: {
    width: rf(98, 72, 102),
    height: rf(98, 72, 102),
    right: rf(-28, -20, -28),
    top: rf(-24, -18, -24),
  },
  ringBottomLeft: {
    width: rf(122, 92, 126),
    height: rf(122, 92, 126),
    left: rf(-40, -30, -40),
    bottom: rf(-60, -45, -60),
  },
  totalBalanceLabel: {
    color: '#E4E4E7',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 16),
    marginBottom: rf(10, 8, 12),
  },
  totalBalanceAmount: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(22, 18, 26),
    lineHeight: rf(30, 24, 34),
  },
  sectionHeading: {
    marginTop: rf(24, 16, 26),
    color: '#F8FAFC',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(16, 14, 18),
    marginBottom: rf(12, 8, 14),
  },
  lightTextPrimary: {
    color: '#09090B',
  },
  lightTextMuted: {
    color: '#52525B',
  },
  lightSoftCard: {
    backgroundColor: '#EFEFEF',
    borderColor: 'rgba(0,0,0,0.06)',
  },
  statsScroll: {
    paddingHorizontal: rf(22, 14, 24),
    paddingBottom: 24,
  },
  statsBackButtonWrap: {
    width: 108,
    alignSelf: 'center',
    marginTop: rf(22, 18, 26),
    marginBottom: rf(8, 6, 12),
  },
  statsBackGradientButton: {
    height: 41,
  },
  statsBackButtonText: {
    fontSize: rf(12, 11, 13),
    lineHeight: rf(16, 14, 17),
  },
  statsTitle: {
    marginTop: rf(22, 14, 24),
    alignSelf: 'center',
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(22, 18, 24),
  },
  statsSwitchWrap: {
    marginTop: rf(16, 12, 18),
    backgroundColor: '#0B0B11',
    borderRadius: rf(16, 12, 18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  statsSwitchBtn: {
    flex: 1,
  },
  statsSwitchBtnFill: {
    borderRadius: rf(12, 10, 14),
    paddingVertical: rf(12, 10, 14),
    alignItems: 'center',
  },
  statsSwitchLabel: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 15),
  },
  statsSubTitle: {
    marginTop: rf(22, 16, 24),
    color: '#A1A1AA',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 15),
    textAlign: 'center',
  },
  statsAmount: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(24, 20, 28),
    lineHeight: rf(32, 24, 34),
    textAlign: 'center',
    marginTop: 4,
  },
  chartWrap: {
    marginTop: rf(18, 14, 20),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: rf(12, 6, 14),
  },
  barItem: {
    alignItems: 'center',
  },
  bar: {
    width: rf(45, 30, 47),
    borderRadius: rf(14, 10, 16),
  },
  barMonth: {
    marginTop: 8,
    color: '#A1A1AA',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(13, 11, 14),
  },
  periodRow: {
    marginTop: rf(18, 12, 20),
    alignItems: 'flex-end',
  },
  periodButton: {
    borderRadius: rf(14, 10, 16),
    overflow: 'hidden',
  },
  periodButtonFill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: rf(10, 8, 11),
    paddingHorizontal: rf(16, 12, 18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  periodText: {
    color: '#D4D4D8',
    fontFamily: 'Lexend_500Medium',
    fontSize: rf(14, 12, 15),
  },
  periodMenu: {
    marginTop: 8,
    width: rf(110, 96, 118),
    backgroundColor: '#111120',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  periodOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  periodOptionText: {
    color: '#D4D4D8',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(13, 11, 14),
  },
  periodOptionTextActive: {
    color: '#95E2A5',
    fontFamily: 'Lexend_600SemiBold',
  },
  bankAddedWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: rf(24, 18, 28),
    gap: rf(24, 18, 28),
  },
  successCircle: {
    width: rf(176, 130, 188),
    height: rf(176, 130, 188),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successHeading: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(22, 18, 24),
    textAlign: 'center',
    lineHeight: rf(32, 24, 34),
  },
  successBackButtonWrap: {
    width: '78%',
    maxWidth: 360,
    marginTop: rf(10, 8, 12),
  },
  statCardsRow: {
    flexDirection: 'row',
    gap: rf(12, 8, 14),
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0B0B11',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: rf(18, 14, 20),
    paddingVertical: rf(12, 10, 14),
    paddingHorizontal: rf(14, 10, 14),
    flexDirection: 'row',
    alignItems: 'center',
  },
  statPercent: {
    color: '#39E9BE',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(14, 12, 15),
    marginLeft: -4,
    marginRight: 6,
  },
  statLabel: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 15),
  },
  transactionsList: {
    marginTop: rf(14, 10, 16),
    gap: rf(10, 8, 12),
  },
  transactionCard: {
    borderRadius: rf(18, 14, 20),
    backgroundColor: '#0E0E14',
    paddingVertical: rf(12, 10, 14),
    paddingHorizontal: rf(18, 12, 20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rf(12, 8, 12),
  },
  transactionTitle: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(15, 13, 16),
  },
  transactionTime: {
    color: '#A1A1AA',
    fontFamily: 'Lexend_400Regular',
    fontSize: rf(12, 10, 13),
    marginTop: 2,
  },
  transactionAmount: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(16, 14, 18),
  },
  addNewWrap: {
    alignItems: 'flex-end',
    marginTop: rf(10, 8, 12),
    marginBottom: rf(14, 10, 16),
  },
  addNewBtn: {
    borderRadius: rf(18, 14, 18),
    paddingHorizontal: rf(32, 24, 34),
    paddingVertical: rf(12, 10, 12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  addNewText: {
    color: '#FFFFFF',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 15),
  },
  bankList: {
    marginTop: 2,
    flex: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  bankListContent: {
    paddingBottom: rf(160, 130, 170),
    gap: rf(16, 12, 18),
    width: '100%',
    alignItems: 'center',
  },
  bankCardStackItem: {
    width: rf(365, 320, 365),
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 9,
  },
  bankReorderOverlay: {
    position: 'absolute',
    right: rf(10, 6, 12),
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: rf(4, 2, 6),
  },
  bankReorderHit: {
    padding: rf(6, 4, 8),
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  bankReorderHitPressed: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bankReorderHitDisabled: {
    opacity: 0.35,
  },
  bankCard: {
    borderRadius: 25,
    height: 166,
    width: '100%',
    paddingHorizontal: rf(24, 16, 26),
    paddingVertical: rf(28, 22, 32),
    overflow: 'hidden',
  },
  lightBankCardBorder: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  bankName: {
    color: '#F3F4F6',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 15),
    marginBottom: 10,
  },
  bankAmount: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_700Bold',
    fontSize: rf(22, 18, 26),
    lineHeight: rf(30, 24, 34),
  },
  viewMoreDimLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: rf(108, 84, 118),
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  viewMoreBtn: {
    alignItems: 'center',
    marginTop: rf(-34, -28, -38),
    marginBottom: rf(8, 6, 10),
    zIndex: 6,
  },
  viewMoreText: {
    color: '#F8FAFC',
    fontFamily: 'Lexend_600SemiBold',
    fontSize: rf(14, 12, 16),
    marginBottom: -6,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottomNavWrap: {
    paddingHorizontal: rf(24, 16, 26),
    paddingBottom: rf(10, 8, 12),
    marginTop: rf(8, 6, 10),
  },
  bottomNav: {
    height: rf(74, 58, 76),
    borderRadius: rf(20, 14, 22),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rf(34, 24, 38),
  },
  navIconBtn: {
    width: rf(42, 34, 44),
    alignItems: 'center',
  },
  floatingPlus: {
    position: 'absolute',
    alignSelf: 'center',
    top: rf(-18, -14, -20),
    width: rf(86, 68, 90),
    height: rf(86, 68, 90),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
});
