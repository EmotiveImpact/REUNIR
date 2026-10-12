import unittest
from pathlib import Path

import phone_type


class PhoneTypeTest(unittest.TestCase):
    def test_generated_sheet_is_current_and_loaded_last(self):
        self.assertEqual(phone_type.OUT.read_text(), phone_type.generate())
        main = (phone_type.WEB / "main.tsx").read_text()
        self.assertTrue(main.rstrip().split("\n")[-1:] and main.index("import './phone-type.css';") > main.index("import './polish.css';"))

    def test_sizes_rise_only_below_twelve(self):
        self.assertEqual([phone_type.phone_size(x) for x in (0, 8, 9, 10, 11, 12, 16)], [0, 11, 11, 12, 12.5, 12, 16])

    def test_desktop_only_rules_are_left_alone(self):
        self.assertIsNone(phone_type.phone_condition(("@media(min-width:1000px)",)))
        self.assertEqual(phone_type.phone_condition(("@media(max-width:370px)",)), "(max-width:370px)")
        self.assertEqual(phone_type.phone_condition(("@media(max-width:1100px)",)), "(max-width:760px)")


if __name__ == "__main__":
    unittest.main()
