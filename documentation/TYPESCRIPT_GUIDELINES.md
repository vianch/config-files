
# Monorepo TypeScrypt-cheatsheet
<p align="center">
  <img src="https://user-images.githubusercontent.com/1800887/157764752-e415f6af-419e-4dcb-aadf-fada09280356.jpeg" />
</p>

### Table of Contents
- [Basics](#basics)
- [Monorepo Pages](#pages)
    - [getInitialProps definitions](#initialprops)
    - [Component declaration](#component-declaration)
- [React Hooks types](#hooks)
    - [useState](#usestate)
    - [useRef](#useref)
- [Redux](#redux)
    - [actions](#redux)
    - [reducers](#reducers)
    - [selectors](#selectors)
- [Interface vs Type vs Class](#interface)
    - [Interface declarations](#interface)
    - [Interface with multiple types](#interfacemultiple)
    - [Types](#types)
        - [Types alias](#types)
        - [Tuples](#tuples)
        - [Conditional types](#conditionaltypes)
        - [Mapped types](#mappedtypes)
        - [Exclude](#exclude)
        - [Extract](#extract)
        - [Instance type](#instancetype)
    - [Class](#class)
    - [Types or Interfaces?](#typequestion)
    - [Other types](#othertypes)
        - [Enums](#enums)
- [Functions](#functions)
- [Unions](#unions)
- [Cheat sheet](#cheatsheet)

<a name="basics" />

## Basics
- Avoid using `any`, `object` or `unknown` types.
- In shared packages we can export types from the `components` folder that we want to import into other projects
```typescript
// TodayTix component file:
import { CookieBannerLabels } from '@todaytix/shared/src/types';

const Labels: CookieBannerLabels = {} as CookieBannerLabels;
```

<a name="pages" />

## Pages

<a name="initialprops" />

### getInitialProps function
- Always declare context type with `TTNextPageContext`, `AppContext` or `NextPageContext`

```typescript
PageName.getInitialProps = async (ctx: TTNextPageContext)
```

- Always return with the type

```typescript

Promise < { props: PageProps<ModelName> } >
Promise < InitialProps < PageModel >>
Promise < InitialProps < PageProps < ModelName >>>
Promise < ModelName >

// Eg:
PageName.getInitialProps = async (ctx: TTNextPageContext): Promise<InitialProps<PageModel>>
{
}
```

<a name="component-declaration" />

### Component declarations [(See Interfaces vs types)](#Interfaces)
- Always declare prop types for custom props types and without inheritance

- Add return `ReactElement` types to components

```typescript
import { ReactElement } from 'react';

type PropType = {
};
const ComponentName = (props: PropType): ReactElement
```

<a name="hooks" />

### Hooks

<a name="usestate" />

#### useState
- Always declare the type when creating a new state

```tsx
interface User {
  name: string;
  age: number;
}
const [user, setUser] = useState<User | null>(null);

// later...
setUser(newUser);
```

<a name="useref" />

#### useRef

```tsx
function Foo() {
  // - If possible, prefer as specific as possible. For example, HTMLDivElement
  //   is better than HTMLElement and way better than Element.
  // - Technical-wise, this returns RefObject<HTMLDivElement>
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Note that ref.current may be null. This is expected, because you may
    // conditionally render the ref-ed element, or you may forgot to assign it
    if (!divRef.current) throw Error('divRef is not assigned');

    // Now divRef.current is sure to be HTMLDivElement
    doSomethingWith(divRef.current);
  });

  // Give the ref to an element so React can manage it for you
  return <div ref={divRef}>etc</div>;
}
```

<a name="redux" />

## Redux
### Actions
- declare an interface / contract for our redux action and action creator returns
```typescript
interface Response {
  code: number;
  isOpen: boolean;
}

enum menuTypes {
  OPEN = "OPEN",
  CLOSE = "CLOSE",
}

export interface MenuOpenAction {
  type: menuTypes;
  payload?: Response;
  error?: string;
}

const openMenuAction = (): MenuOpenAction => ({
  type: menuTypes.OPEN,
  payload: {
    code: 201,
    isOpen: true
  }
}); 
```

<a name="reducers" />

### Reducers
- Declare state type / contract
```typescript
interface ResponseState {
  payload: Response;
}

const initalState: ResponseState = {
  code: 404,
  response: null
}
```
- On the reducer function use the action and state interfaces
```typescript
const menuReducer = (
  state = initialState,
  action: MenuOpenAction,
): ResponseState => {};
```

### Selectors
- In `rootReducer.ts` file we need to create a type for the state
```typescript
const rootReducers = combineReducers({ Shows, Menu });
export type RootReducer = ReturnType<typeof rootReducers>;
```
or
```typescript
const reducer = combineReducers({
  checkout,
  content,
  viewer,
});
export type StateType = ReturnType<typeof reducer>;
```
- Then use the state type in the selectors

```typescript
import { StateType } from './rootReducer';

const selectMenuState = (state: StateType): Response => get(state, 'menu', {} as MenuState);
```

<a name="interface" />

## Interfaces

#### Interface declaration

```tsx
class Someclass {}

interface Parent {
  parentProperty: Type;
  x: number;
  y: number;
  z?: number;
}

interface Child extends Parent, SomeClass {
  property: Type;
  optionalProp?: Type;
  optionalMethod?(argument: Type): ReturnType;
}

const myConst: Child; // { parentProperty, x, y, z, property, optionalProp, optionalMethod}

class MyClass implements Child {
  public parentProperty: Type;
  public x: number;
  public y: number;
  public property: Type;
  public optionalProp: Type;

  public optionalMethod(argument: Type): ReturnType {
    const myConst: Type;

    return myConst;
  }
}
```

- Interfaces can also **extend** other **interfaces** or **classes** using the `extends` keyword in order to compose more complex types out of simple types

<a name="interfacemultiple" />

#### Interface with multiple types

```tsx
interface Pair<T1, T2> {
  first: T1;
  second: T2;
}

const myConst: Pair<number, string>; // {first, second} where first is a number and the second a string
```

<a name="types" />

## Types
#### Type alias

```tsx
type Name = string;

type Direction = 'left' | 'right';

type ElementCreator = (type: string) => Element;

type Point = { x: number; y: number };

type Point3D = Point & { z: number };

type PointProp = keyof Point; // 'x' | 'y'

const point: Point = { x: 1, y: 2 };

type PtValProp = keyof typeof point; // 'x' | 'y'
```

<a name="tuples" />

#### Basic tuples

```tsx
let myTuple: [string, number, boolean?];
myTuple = ['test', 42];
```

#### Variadic tuples

```tsx
type Numbers = [number, number];
type Strings = [string, string];

type NumbersAndStrings = [...Numbers, ...Strings]; // [number, number, string, string]
let myTuple: NumbersAndStrings;
myTuple = [1, 2, 'test1', 'test2'];
```

<a name="conditionaltypes" />

#### Conditional types

```tsx
type Swapper = <T extends number | string>(
  value: T,
) => T extends number ? string : number;
```

equivalent to (if T is Number)
`(value: number) => number`
equivalent to (if T is String)
`(value: string) => string`

<a name="mappedtypes" />

#### Conditional mapped types

```tsx
interface Person {
  firstName: string;
  lastName: string;
  age: number;
}

type StringProps<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
};

type PersonStrings = StringProps<Person>;

// PersonStrings is "firstName" | "lastName"
```

<a name="exclude" />

#### Exclude

`type Excluded = Exclude<string | number, string>;` equivalent to `number`

<a name="extract" />

#### Extract

`type Extracted = Extract<string | number, string>;` equivalent to `string`

<a name="instancetype" />

#### InstanceType

```tsx
class Renderer() {}
type Instance = InstanceType<typeof Renderer>;
```

is equivalent to

```
Renderer
```

<a name="class" />

## Class

```tsx
interface Child {
  methodProperty: (argument: Type) => ReturnType;
}

interface OtherChild {
  overloadedMethod(argument: Type): ReturnType;
}

class Parent {}

class Child extends Parent implements Child, OtherChild {
  public property: Type;
  public argument: Type;
  public defaultProperty = 'default value';
  static staticProperty: Type;
  private readonly _privateReadonlyProperty: Type;
  private _privateProperty: Type;

  constructor(argument: Type, public argumentTwo) {
    super(argument);
    this.argument = argument;
  }

  static staticMethod(): ReturnType {}
  private _privateMethod(): Type {}

  public methodProperty: (argument: Type) => ReturnType;
  public overloadedMethod(argument: Type): ReturnType;
  public overloadedMethod(argument: OtherType): ReturnType;
  public overloadedMethod(argument: CommonT): CommonReturnT {}
}
```

<a name="typequestion" />

## Types or Interfaces?

If you would like a heuristic (practical), use interface until you need to use features from type.

Here's a helpful rule of thumb:

1. Always use `interface` for public API's definition when authoring a library or 3rd party ambient type definitions, as this allows a consumer to extend them via _declaration merging_ if some definitions are missing.
2. Consider using `type` for your React Component Props and State, for consistency and because it is more constrained.

**Interface** work better with **objects** and **method objects**, and **types** are better to work with **functions**, **complex types**, etc. You should not start to use one and delete the other. Instead of doing that, start to refactor slowly, thinking of what makes more sense to that specific situation.

### Useful table for Types vs Interfaces

It's a nuanced topic, don't get too hung up on it. Here's a handy table:

| Aspect                                          | Type | Interface |
| ----------------------------------------------- | :--: | :-------: |
| Can describe functions                          |  ✅  |    ✅     |
| Can describe constructors                       |  ✅  |    ✅     |
| Can describe tuples                             |  ✅  |    ✅     |
| Interfaces can extend it                        |  ⚠️  |    ✅     |
| Classes can extend it                           |  🚫  |    ✅     |
| Classes can implement it (`implements`)         |  ⚠️  |    ✅     |
| Can intersect another one of its kind           |  ✅  |    ⚠️     |
| Can create a union with another one of its kind |  ✅  |    🚫     |
| Can be used to create mapped types              |  ✅  |    🚫     |
| Can be mapped over with mapped types            |  ✅  |    ✅     |
| Expands in error messages and logs              |  ✅  |    🚫     |
| Can be augmented                                |  🚫  |    ✅     |
| Can be recursive                                |  ⚠️  |    ✅     |

⚠️ In some cases

(source: [Karol Majewski](https://twitter.com/karoljmajewski/status/1082413696075382785))

![typesVsInterfacesTweet](https://user-images.githubusercontent.com/1800887/153976740-ea5b15f2-0d09-46b5-8783-bb388c0eb694.png)

#### Types Interface Equivalent

![typesEquivalent](https://user-images.githubusercontent.com/1800887/153990739-6420b14b-9df4-483c-9b7f-b35e11a364df.png)

<a name="othertypes" />

# Other types

## Arrays and tuples

#### Array of strings

`string[]` or `Array<string>`

#### Array of functions that return strings

`tsx (() => string)[] ` or `{ (): string; }[]` or `Array<() => string>`

<a name="enums" />

## Enums

```tsx
// bad: lowercase enum names
enum options {}

// good: PascalCase (the first letter of every word is uppercase)
enum Options {}

// bad: properties in lower case
enum Colors {
   red = '#FF0000', 
}

// good: properties in PascalCase or UPPERCASE
enum Colors {
  Red = '#FF0000',
}

enum Colors {
  RED = '#FF0000',
}

// eg: different types of enums
enum Options {
  FIRST,
  EXPLICIT = 1,
  BOOLEAN = Options.FIRST | Options.EXPLICIT,
  COMPUTED = getValue(),
}

enum Colors {
  Red = '#FF0000',
  Green = '#00FF00',
  Blue = '#0000FF',
}
```

<a name="functions" />

## Functions

#### Function type

`(argument: Type, argN: Type) => Type;`
or
`(argument: Type, argN: Type): Type;`

#### Function type with optional param

`(argument: Type, optional?: Type) => ReturnType`

#### Function type with rest param

`(argument: Type, ...allOtherArgs: Type[]) => ReturnType`

#### Default argument

`function myFunction(argument = 'default'): ReturnType {}`

#### Arrow function

`(argument: Type): ReturnType => { ...; return value; }`
or
`(argument: Type): ReturnType => value`

#### Overloads

```tsx
function myFunction(a: string): number;
function myFunction(a: number): string;
function myFunction(a: string | number): string | number {
    ...
}
```

<a name="unions" />

## Union and intersection types

#### Union

`let myUnionVariable: number | string;`

#### Intersection

`let myIntersectionType: Foo & Bar;`

## Utility types

#### Partial

`Partial<{ x: number; y: number; z: number; }>`
equivalent to
`{ x?: number; y?: number; z?: number; }`

#### Readonly

`Readonly<{ x: number; y: number; z: number; }>`
equivalent to

```tsx
{
    readonly x: number;
    readonly y: number;
    readonly z: number;
}
```

#### Record

`Record<'x' | 'y' | 'z', number>`
equivalent to
` { x: number; y: number; z: number; }`

#### Assertions / Cast

`let val = someValue as string;`

## Ambient declarations

#### Global

`declare const $: JQueryStatic;`

#### Module

```tsx
declare module "foo" {
    export class Bar { ... }
}
```

<a name="cheatsheet" />

## Handbook Cheat sheet

![TypeScript Interfaces-34f1ad12132fb463bd1dfe5b85c5b2e6](https://user-images.githubusercontent.com/1800887/153991180-467e6a80-17c6-434c-a0b7-2b67ce3024fc.png)
![TypeScript Types-4cbf7b9d45dc0ec8d18c6c7a0c516114](https://user-images.githubusercontent.com/1800887/153991194-07584a0d-8109-4ce2-bc50-40209f6b0c3e.png)
![TypeScript Classes-83cc6f8e42ba2002d5e2c04221fa78f9](https://user-images.githubusercontent.com/1800887/153991202-b7381e3e-2d81-4069-a911-971b453ca602.png)

## Sources:

- [TypeScript-React cheat sheet](https://github.com/typescript-cheatsheets/react/blob/main/README.md).
- [Differences between types-aliases](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces)
- [TypeScript HandBook](https://www.typescriptlang.org/static/TypeScript%20Control%20Flow%20Analysis-8a549253ad8470850b77c4c5c351d457.png)