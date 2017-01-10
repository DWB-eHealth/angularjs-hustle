angularjs-hustle
================
Angularjs-hustle is a angular provider for [hustle](https://github.com/DWB-eHealth/hustle) library.

### Tech Stack
- AngularJS
- IndexedDB

### Requirements
- npm
- bower

### Installation
 1. This modules requires angular and [hustle](https://github.com/DWB-eHealth/hustle) to be set on global scope (window).
 2. Load hustle-module using regular `script` tag or through any module loaders.

### Usage
To load the `angular-hustle` in any angular module.
 
   ```
   angular.module("appName", ['hustle']);
   ```

### Developing this module

1. Clone this repository.

1. Navigate to the `angularjs-hustle` folder and run the following commands:
  ```
  npm install
  bower cache clean
  bower install
  ```

1. Run the below the command to run the tests
  ```
  ./runtest.sh
  ```
