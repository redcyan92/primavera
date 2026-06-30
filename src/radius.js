// Shared border-radius scale. Use these tokens instead of hardcoded px values
// so roundness stays consistent across the app as new UI is added.
export const radius = {
  none: '0',
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  xxl: '12px',
  pill: '999px', // fully rounded pill/circle edges; browser caps to half the element's height
  circle: '50%',
};
