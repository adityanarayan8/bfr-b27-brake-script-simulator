# **B27 Brake Script Simulator**

## **Deployment**

The application is deployed as a static site on Cloudflare Pages.
**Production URL:**

```text
https://bfr-b27-brake-script-simulator.pages.dev
```

Browser implementation of the Berkeley Formula Racing brake model from `brakescript_w_aero_B27.m`. The simulator evaluates brake bias, tire loading, deceleration, pedal force, brake torque, hydraulic line pressure, and lockup behavior across vehicle speed while allowing multiple brake configurations to be compared on the same plots.

The application is entirely static. It runs in the browser without a backend, API keys, or external runtime dependencies.

## **Running locally**

### **Offline version**

**Open:**

```text
brake-tool-offline.html
```

The offline build contains the complete application and does not require a server or network connection.

**Regenerate it after changing the source modules:**

```bash
python3 tools/build-local.py
```

### **Development version**

**Run a local HTTP server from the repository root:**

```bash
python3 -m http.server 8000
```

**Then open the application at:**

```text
http://localhost:8000
```

The multi-file version loads the JavaScript modules directly from `js/`.

## **Model and calculations**

The simulator follows the brake model used by the MATLAB script. It calculates master-cylinder and caliper piston areas, front/rear brake bias, tire grip as a function of normal load, aerodynamic downforce, longitudinal weight transfer, and the resulting vehicle deceleration. For each vehicle speed, the solver iterates on deceleration until the tire-limited braking force converges, then uses the resulting front and rear normal forces to calculate the pedal force required to reach lockup.

The primary plots are pedal force versus speed and deceleration versus speed, with additional plots for brake torque, hydraulic line pressure, brake-bias sensitivity, and driver-weight sensitivity. Front and rear traces are displayed separately, and the plots identify which axle reaches the tire-grip limit first.

## **Inputs**

Each configuration contains the vehicle, pedal box, hydraulic, rotor, caliper, pad, and aerodynamic parameters used by the brake model.

**The main inputs include:**

```text
Pedal ratio
Front and rear master-cylinder bore
Bias-bar front bias
Front and rear caliper bore and piston count
Front and rear rotor outer and inner diameter
Front and rear pad coefficient of friction
Tire radius
Wheelbase
Center-of-gravity height
Rear weight bias
Vehicle and driver weight
Aerodynamic coefficient, air density, and wing area
```

Unit selectors are available in the interface. Internally, values follow the conventions used by the MATLAB model so results can be compared directly with the original calculations.

Caliper bore is stored in millimetres, while master-cylinder bore and rotor dimensions follow the units used by the reference script.

## **Brake bias and tire loading**

Brake torque demand is derived from hydraulic pressure, caliper piston area, rotor effective radius, and pad friction. The effective brake bias is calculated from the front and rear brake torque capacity:

```text
effectiveBrakeBias =
    rearTotal / (frontTotal + rearTotal)
```

Tire grip is load-dependent:

```text
tireMu(Fz) = (1.8073 - 0.00018293 * Fz) * 0.875 * 0.95
```

At each speed, the model combines static axle loading, aerodynamic downforce, and longitudinal weight transfer to determine the front and rear normal forces. The axle that reaches its available tire grip first determines the lockup condition used for the deceleration calculation.

## **Aerodynamic model**

The updated downforce model uses:

```text
Downforce =
    0.5 * Cl * airDensity * velocity² * wingArea
```

with vehicle speed converted from mph to m/s before the aerodynamic calculation.

The model can use a constant aerodynamic center of pressure or a speed/deceleration-dependent center of pressure. With the variable center-of-pressure option enabled, the MATLAB model defines:

```text
cp(deceleration) =
    0.604 - deceleration * (0.1364 / 2.3)
```

The simulator preserves the equations used by the reference model so its results remain comparable with the validated MATLAB outputs.

## **Configuration comparison**

Up to four brake configurations can be evaluated at the same time. Each configuration has independent inputs and can be enabled, duplicated, renamed, or removed without changing the others.

The comparison view overlays the resulting front and rear traces on the same axes, making it possible to compare changes to pedal ratio, master-cylinder sizing, caliper sizing, rotor dimensions, friction coefficients, bias-bar position, or vehicle parameters.

## **Validation checks**

The simulator includes checks for the component and vehicle combinations entered into the model, including:

* Rotor outside diameter versus the selected caliper's supported disc range
* Pad swept height versus the rotor annulus
* Rotor inner diameter relative to the outer diameter
* Bias-bar position outside the mechanical range of 0.45 to 0.63
* Solver convergence failures
* Negative rear normal force
* Pedal force outside the target band at active event speeds

The validation suite also compares the browser solver against the MATLAB reference values. The 0 mph case is independent of aerodynamic loading and is used to isolate the hydraulic and brake-force calculations.

## **Optimizer**

The optimizer searches for the brake-bias setting that minimizes the front/rear imbalance while satisfying the target pedal-force range. A mathematically balanced configuration is not treated as valid when its absolute pedal force is outside the specified operating band.

When no configuration satisfies the target band, the simulator reports the closest result and separately identifies the best balance that remains outside the valid pedal-force range.

## **Plots and exported data**

The simulator provides six plot types:

1. Pedal force versus vehicle speed
2. Deceleration versus vehicle speed
3. Brake torque
4. Hydraulic line pressure
5. Brake-bias sweep
6. Driver-weight sensitivity

Plots support hover values and PNG export. The CSV export contains the solved values for each speed, including:

```text
Speed
Deceleration
Front and rear pedal force
Front and rear normal force
Downforce
Center of pressure
Dynamic weight transfer
Brake torque
Hydraulic line pressure
```

Speeds that do not converge are exported as blank values rather than being represented as zero.

## **Project structure**

```text
index.html                application markup
404.html                  not-found page
css/app.css               styling

js/solver.js              brake physics and solver
js/components.js          component definitions
js/config.js              defaults and validation rules
js/optimize.js            brake-bias optimization
js/plots.js               canvas rendering
js/units.js               unit conversion
js/dom.js                 DOM helpers
js/state.js               application state
js/fields.js              input widgets
js/panel.js               configuration panel
js/charts.js              plot containers
js/results.js             validation and result views
js/share.js               URL state and CSV export
js/ui.js                  application wiring and recomputation

test/                     automated validation
tools/build-local.py      offline build generator
brake-tool-offline.html   generated single-file build
```

The physics solver is isolated from the DOM, so the braking calculations can be executed independently of the interface. UI components consume solver results rather than performing the underlying brake calculations.

## **Reference model**

The browser simulator is based on `brakescript_w_aero_B27.m`. The supplied `aug14brakescript.m` is an earlier MATLAB revision and uses different parameter values, including:

```text
carWeight       = 390 lbf
rearBias        = 0.515
centerGravityZ = 12.5 in
rearRotorMu    = 0.475
Cl              = 1.055
```

Those differences are sufficient to change the resulting validation values, so the B27 reference file remains the source of truth for the browser implementation.
