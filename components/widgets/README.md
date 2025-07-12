# FitnessWidget - Android Widget Compatible

## Overview
The FitnessWidget is designed to work with Android widgets and is compatible with `react-native-android-widget`. It displays a single 2x2 layout with current day's step count in a ring format and key statistics.

## Key Features

### 1. Android Widget Compatible
- **No React Hooks**: Pure functional component without useState/useEffect
- **Static Rendering**: Works with react-native-android-widget preview system
- **Optional Data Props**: Accepts step data as props or uses default mock data

### 2. Single Layout Design
- Clean 2x2 grid layout with ring progress on the left and stats on the right
- Ring progress indicator showing daily step completion
- Green ring when goal is achieved, white for partial progress

### 3. 2x2 Stats Grid
- **Goal**: Daily step target
- **Week Avg**: Weekly average steps
- **Distance**: Distance covered in kilometers
- **Progress**: Completion percentage

## Usage

### Static Widget (Default Mock Data)
```tsx
<FitnessWidget />
```

### With Custom Data
```tsx
<FitnessWidget 
    stepData={{
        currentSteps: 8247,
        stepGoal: 10000,
        weekAvg: 7420,
        distance: 6.6
    }} 
/>
```

### With Real Health Data (React Component)
For apps that need real health data, use the data provider:
```tsx
<FitnessWidgetDataProvider />
```

## Components

### 1. FitnessWidget (Pure Widget)
- Compatible with Android widget system
- No hooks or side effects
- Accepts optional stepData prop
- Falls back to realistic mock data

### 2. FitnessWidgetDataProvider (React Wrapper)
- Uses React hooks for data management
- Integrates with Health Connect API
- Provides real step data to FitnessWidget
- Use this in regular React apps, not in widget previews

## Data Structure

```typescript
interface StepData {
    currentSteps: number;    // Current day's steps
    stepGoal: number;        // Daily goal
    weekAvg: number;         // Weekly average
    distance: number;        // Distance in km
}
```

## Layout Structure

```
┌─────────────────────────────────────┐
│ Daily Steps              [Refresh]  │
├─────────────────┬───────────────────┤
│                 │  Goal   │ Week Avg│
│   Ring Progress ├─────────┼─────────┤
│                 │Distance │Progress │
└─────────────────┴───────────────────┘
```

## Widget Actions

- `refresh_steps`: Triggered by refresh button click
- Can be handled by parent widget system for additional functionality

## Error Handling

The original issue with "Invalid hook call" has been resolved by:
1. Removing React hooks from the main widget component
2. Creating a separate data provider for React app usage
3. Making the widget purely functional and static-friendly

## Example Implementation

```tsx
// For widget preview (no hooks)
<WidgetPreview
    renderWidget={() => <FitnessWidget />}
    width={320}
    height={200}
/>

// For React app with real data
<FitnessWidgetDataProvider />
```

## Color Scheme

- **Background**: Light blue (#5CC6E2)
- **Progress Ring**: White (partial), Green (complete)
- **Text**: White with varying opacity
- **Stats Cards**: Semi-transparent white backgrounds

The widget is now fully compatible with Android widget systems while maintaining the ability to display real health data when used in React applications!
