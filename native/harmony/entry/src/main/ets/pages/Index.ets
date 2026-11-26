import { Login } from './Login';
import { Home } from './Home';

@Entry
@Component
struct Index {
  @State loggedIn: boolean = false;

  build() {
    Column() {
      if (this.loggedIn) {
        Home()
      } else {
        Login({
          onLogin: (): void => {
            this.loggedIn = true;
          }
        })
      }
    }
    .width('100%')
    .height('100%')
  }
}
