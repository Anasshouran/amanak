import { render, screen } from "@testing-library/react-native"
import Family from "../../../family"

describe("Family tab", () => {
  it("renders heading", () => {
    render(<Family />)
    expect(screen.getByText(/Family Protection/i)).toBeTruthy()
  })
})
